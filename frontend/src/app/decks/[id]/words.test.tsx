import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { UserWord } from "@/lib/words";

import { DeckWordsContent } from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function word(id: number, word_text: string, overrides: Partial<UserWord> = {}): UserWord {
  return {
    id,
    deck: 1,
    word_text,
    part_of_speech: "",
    ipa: "",
    meaning_vi: "",
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

/** Minimal in-memory backend for one deck's words. */
function stubWordServer(initial: UserWord[]) {
  let words = [...initial];
  let nextId = 1000;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/decks/1" && method === "GET") {
      return jsonResponse(200, {
        id: 1,
        name: "IELTS",
        description: "",
        visibility: "private",
        created_at: "",
        updated_at: "",
      });
    }
    if (url === "/api/v1/decks/1/words" && method === "GET") {
      return jsonResponse(200, { count: words.length, next: null, previous: null, results: words });
    }
    if (url === "/api/v1/decks/1/words" && method === "POST") {
      const body = JSON.parse(init!.body as string);
      const created = word(nextId++, body.word, { enrichment_status: "pending" });
      words = [created, ...words];
      return jsonResponse(201, created);
    }
    const detail = url.match(/\/api\/v1\/words\/(\d+)$/);
    if (detail && method === "GET") {
      const found = words.find((w) => w.id === Number(detail[1]));
      return found
        ? jsonResponse(200, found)
        : jsonResponse(404, { detail: "x", code: "not_found" });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { current: () => words };
}

function renderWords() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeckWordsContent deckId={1} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("renders deck name, completed content and a retry button for failed words", async () => {
  stubWordServer([
    word(1, "hello", { meaning_vi: "lời chào", ipa: "/həˈloʊ/", example_en: "Hello there." }),
    word(2, "world", { enrichment_status: "failed" }),
  ]);
  renderWords();

  expect(await screen.findByText("IELTS")).toBeInTheDocument();
  expect(screen.getByText("hello")).toBeInTheDocument();
  expect(screen.getByText("lời chào")).toBeInTheDocument();
  expect(screen.getByText("/həˈloʊ/")).toBeInTheDocument();
  expect(screen.getByText(/tra cứu thất bại/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
});

test("shows the empty state when the deck has no words", async () => {
  stubWordServer([]);
  renderWords();
  expect(await screen.findByText(/chưa có từ nào/i)).toBeInTheDocument();
});

test("adds a word and shows it as pending after refetch", async () => {
  const server = stubWordServer([]);
  renderWords();
  await screen.findByText(/chưa có từ nào/i);

  fireEvent.change(screen.getByLabelText("Từ mới"), { target: { value: "serendipity" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm từ" }));

  expect(await screen.findByText("serendipity")).toBeInTheDocument();
  expect(screen.getByText(/đang tra cứu/i)).toBeInTheDocument();
  await waitFor(() => expect(server.current().map((w) => w.word_text)).toContain("serendipity"));
});
