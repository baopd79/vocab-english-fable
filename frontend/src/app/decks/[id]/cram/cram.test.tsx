import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { UserWord } from "@/lib/words";

import { CramContent } from "./page";

function word(overrides: Partial<UserWord>): UserWord {
  return {
    id: 1,
    deck: 5,
    word_text: "hello",
    part_of_speech: "",
    ipa: "",
    meaning_vi: "xin chào",
    example_en: "",
    example_vi: "",
    enrichment_status: "completed",
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    due_at: "",
    first_reviewed_at: null,
    last_reviewed_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Two pages of deck words so the session has to page through the list. */
function stubDeckWords() {
  const page1 = [
    word({ id: 1, word_text: "hello", meaning_vi: "xin chào" }),
    word({ id: 2, word_text: "humble", meaning_vi: "khiêm tốn" }),
    word({ id: 3, word_text: "broken", enrichment_status: "pending" }),
  ];
  const page2 = [word({ id: 4, word_text: "candid", meaning_vi: "thẳng thắn" })];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/v1/decks/5/words?page=1&page_size=100") {
      return json({ count: 4, next: "…page=2", previous: null, results: page1 });
    }
    if (url === "/api/v1/decks/5/words?page=2&page_size=100") {
      return json({ count: 4, next: null, previous: null, results: page2 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderCram() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CramContent deckId={5} />
    </QueryClientProvider>,
  );
}

/** Drive the visible card through typing → flip → the given self-grade. */
function answerCurrentCard(grade: "Chưa nhớ" | "Đã nhớ") {
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(grade) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a full cram session never sends anything but GET (AC §17.2-11)", async () => {
  const fetchMock = stubDeckWords();
  renderCram();

  // 3 completed words across 2 pages; the pending one is skipped.
  expect(await screen.findByText("Còn 3 thẻ")).toBeInTheDocument();

  // First card: "Chưa nhớ" requeues it at the end (session grows to 4 steps).
  answerCurrentCard("Chưa nhớ");
  answerCurrentCard("Đã nhớ");
  answerCurrentCard("Đã nhớ");
  answerCurrentCard("Đã nhớ");

  expect(await screen.findByText("Xong phiên ôn tự do!")).toBeInTheDocument();
  expect(screen.getByText("Đã thuộc 3 thẻ, 1 lượt chưa nhớ.")).toBeInTheDocument();

  // The heart of cram mode: nothing but reads — no answer API, no ReviewLog,
  // so the DB cannot have changed.
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [, init] of fetchMock.mock.calls) {
    expect(init?.method ?? "GET").toBe("GET");
  }
});

test("cram forces the typing step even for never-reviewed cards", async () => {
  stubDeckWords();
  renderCram();

  // Every fixture card has first_reviewed_at=null; in SM-2 review these would
  // start flipped, in cram they still get the recall-by-typing step.
  expect(await screen.findByLabelText("Đáp án")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
  expect(screen.getByRole("button", { name: /Chưa nhớ/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Đã nhớ/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Again/ })).not.toBeInTheDocument();
});

test("grade hotkeys are consumed so the digit never leaks into the next input", async () => {
  stubDeckWords();
  renderCram();

  await screen.findByText("Còn 3 thẻ");
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));

  // fireEvent returns false when the handler called preventDefault — without
  // it the "2" would be typed into the next card's autofocused input.
  const notCancelled = fireEvent.keyDown(window, { key: "2" });
  expect(notCancelled).toBe(false);

  // The key did grade the card: we are on the next one, back in typing phase.
  expect(screen.getByText("Còn 2 thẻ")).toBeInTheDocument();
  expect(screen.getByLabelText("Đáp án")).toHaveValue("");
});

test("a deck with no enriched words points back to the deck", async () => {
  const only = [word({ id: 9, enrichment_status: "pending" })];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ count: 1, next: null, previous: null, results: only })),
  );
  renderCram();

  expect(
    await screen.findByText("Deck này chưa có từ nào tra cứu xong để ôn."),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← Về deck" })).toHaveAttribute("href", "/decks/5");
});
