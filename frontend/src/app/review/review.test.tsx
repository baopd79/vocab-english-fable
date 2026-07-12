import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { isMuted, playCorrect, playFanfare, playWrong, setMuted } from "@/lib/sfx";
import type { UserWord } from "@/lib/words";

import { ReviewContent } from "./page";

// Sounds are exercised in sfx.test.ts; here we only assert the wiring.
vi.mock("@/lib/sfx", () => ({
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  playFanfare: vi.fn(),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function card(
  id: number,
  word_text: string,
  isNew: boolean,
  overrides: Partial<UserWord> = {},
): UserWord {
  return {
    id,
    deck: 1,
    word_text,
    part_of_speech: "noun",
    ipa: "",
    meaning_vi: `nghĩa của ${word_text}`,
    example_en: "",
    example_vi: "",
    enrichment_status: "completed",
    ease_factor: 2.5,
    interval_days: isNew ? 0 : 6,
    repetitions: isNew ? 0 : 2,
    due_at: "",
    first_reviewed_at: isNew ? null : "2026-06-01T00:00:00Z",
    last_reviewed_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

/** Per-deck counts the way the backend selector builds them (deck names are
 * synthesized as "Deck <id>" for assertions). */
function breakdown(queue: { due: UserWord[]; new: UserWord[] }) {
  const counts = new Map<number, { due_count: number; new_count: number }>();
  for (const c of queue.due) {
    const entry = counts.get(c.deck) ?? { due_count: 0, new_count: 0 };
    entry.due_count += 1;
    counts.set(c.deck, entry);
  }
  for (const c of queue.new) {
    const entry = counts.get(c.deck) ?? { due_count: 0, new_count: 0 };
    entry.new_count += 1;
    counts.set(c.deck, entry);
  }
  return [...counts.entries()].map(([deck_id, c]) => ({
    deck_id,
    deck_name: `Deck ${deck_id}`,
    ...c,
  }));
}

function stubReviewServer(queue: { due: UserWord[]; new: UserWord[] }) {
  const answers: { user_word_id: number; rating: string }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/review/queue" && method === "GET") {
      return jsonResponse(200, { ...queue, decks: breakdown(queue) });
    }
    if (url === "/api/v1/review/answer" && method === "POST") {
      answers.push(JSON.parse(init!.body as string));
      return jsonResponse(200, {});
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { answers };
}

function renderReview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewContent />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(isMuted).mockReturnValue(false);
});

test("empty queue shows the done state", async () => {
  stubReviewServer({ due: [], new: [] });
  renderReview();
  expect(await screen.findByText(/không có thẻ nào cần ôn/i)).toBeInTheDocument();
});

test("overview shows per-deck counts and only starts the session on click", async () => {
  stubReviewServer({
    due: [card(1, "resilience", false)],
    new: [card(2, "serendipity", true, { deck: 2 })],
  });
  renderReview();

  // SPEC §17.2-7 — /review no longer jumps straight into the first card.
  expect(await screen.findByText("Ôn tập hôm nay")).toBeInTheDocument();
  expect(screen.queryByLabelText("Đáp án")).not.toBeInTheDocument();

  // Per-deck breakdown from the API is rendered.
  expect(screen.getByText("Deck 1")).toBeInTheDocument();
  expect(screen.getByText("Deck 2")).toBeInTheDocument();
  expect(screen.getByText("1 đến hạn")).toBeInTheDocument();
  expect(screen.getByText("1 mới")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Bắt đầu ôn 2 thẻ/ }));
  expect(await screen.findByLabelText("Đáp án")).toBeInTheDocument();
});

test("full session: due card typed, new card flipped, Again re-queues, then summary", async () => {
  const server = stubReviewServer({
    due: [card(1, "resilience", false)],
    new: [card(2, "serendipity", true)],
  });
  renderReview();

  // 0) Pass the overview screen (SPEC §17.1-B3).
  fireEvent.click(await screen.findByRole("button", { name: /Bắt đầu ôn/ }));

  // 1) Due card first → typing step.
  await screen.findByLabelText("Đáp án");
  fireEvent.change(screen.getByLabelText("Đáp án"), { target: { value: "resilience" } });
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
  fireEvent.click(screen.getByRole("button", { name: /Good/ }));

  // 2) New card next → no typing, straight to flip. Grade Again → re-queue.
  await screen.findByText("serendipity");
  expect(screen.queryByLabelText("Đáp án")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Again/ }));

  // 3) The Again card comes back at the end of the session.
  await waitFor(() => expect(screen.getByText("serendipity")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /Good/ }));

  // 4) Summary.
  expect(await screen.findByText(/Xong phiên ôn/i)).toBeInTheDocument();
  expect(screen.getByText(/Đã ôn 2 thẻ/)).toBeInTheDocument();

  // API received each grade with the right payload.
  expect(server.answers).toEqual([
    { user_word_id: 1, rating: "good" },
    { user_word_id: 2, rating: "again" },
    { user_word_id: 2, rating: "good" },
  ]);

  // SPEC §17.2-8 — chimes per grade, fanfare once at the end.
  expect(playCorrect).toHaveBeenCalledTimes(2);
  expect(playWrong).toHaveBeenCalledTimes(1);
  expect(playFanfare).toHaveBeenCalledTimes(1);
});

test("mute toggle flips label and persists via setMuted", async () => {
  stubReviewServer({ due: [card(1, "resilience", false)], new: [] });
  renderReview();
  fireEvent.click(await screen.findByRole("button", { name: /Bắt đầu ôn/ }));

  const toggle = await screen.findByRole("button", { name: "Tắt âm thanh" });
  fireEvent.click(toggle);

  expect(setMuted).toHaveBeenCalledWith(true);
  expect(screen.getByRole("button", { name: "Bật âm thanh" })).toBeInTheDocument();
});
