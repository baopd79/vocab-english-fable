import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { UserWord } from "@/lib/words";

import { ReviewContent } from "./page";

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

function stubReviewServer(queue: { due: UserWord[]; new: UserWord[] }) {
  const answers: { user_word_id: number; rating: string }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/review/queue" && method === "GET") {
      return jsonResponse(200, queue);
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
});

test("empty queue shows the done state", async () => {
  stubReviewServer({ due: [], new: [] });
  renderReview();
  expect(await screen.findByText(/không có thẻ nào cần ôn/i)).toBeInTheDocument();
});

test("full session: due card typed, new card flipped, Again re-queues, then summary", async () => {
  const server = stubReviewServer({
    due: [card(1, "resilience", false)],
    new: [card(2, "serendipity", true)],
  });
  renderReview();

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
});
