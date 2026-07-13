import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { Deck, Paginated } from "@/lib/decks";
import type { UserWord } from "@/lib/words";

import { QuickAdd, QuickAddModal } from "./quick-add";

function deck(overrides: Partial<Deck>): Deck {
  return {
    id: 1,
    name: "IELTS",
    description: "",
    visibility: "private",
    word_count: 0,
    mastered_count: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const DECKS: Paginated<Deck> = {
  count: 2,
  next: null,
  previous: null,
  results: [deck({ id: 1, name: "IELTS" }), deck({ id: 2, name: "Giao tiếp" })],
};

function createdWord(
  deckId: number,
  wordText: string,
  overrides: Partial<UserWord> = {},
): UserWord {
  return {
    id: 10,
    deck: deckId,
    word_text: wordText,
    part_of_speech: "",
    ipa: "",
    meaning_vi: "",
    example_en: "",
    example_vi: "",
    enrichment_status: "pending",
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stub fetch: GET /decks → `decks`; POST …/words → created word (or the
 * `onAddWord` override); GET /words/:id → the last created word (the
 * "Vừa thêm" rows refetch themselves). */
function stubApi({
  decks = DECKS,
  wordOverrides = {},
  onAddWord,
}: {
  decks?: Paginated<Deck>;
  wordOverrides?: Partial<UserWord>;
  onAddWord?: (url: string) => Response;
} = {}) {
  let lastCreated: UserWord | null = null;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/decks" && method === "GET") return json(decks);
    if (url.endsWith("/words") && method === "POST") {
      if (onAddWord) return onAddWord(url);
      const deckId = Number(url.match(/decks\/(\d+)\/words/)?.[1]);
      const { word } = JSON.parse(String(init?.body)) as { word: string };
      lastCreated = createdWord(deckId, word, wordOverrides);
      return json(lastCreated, 201);
    }
    if (/\/api\/v1\/words\/\d+$/.test(url) && method === "GET" && lastCreated) {
      return json(lastCreated);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function openModal() {
  fireEvent.click(screen.getByRole("button", { name: "Thêm từ nhanh" }));
  return screen.findByRole("dialog", { name: "Thêm từ nhanh" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("opens the modal, preselects the first deck, closes on Escape", async () => {
  stubApi();
  wrap(<QuickAdd />);

  await openModal();
  const first = await screen.findByRole("button", { name: "IELTS" });
  expect(first).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Giao tiếp" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("preselects the last-used deck stored in localStorage", async () => {
  localStorage.setItem("quick-add-deck", "2");
  stubApi();
  wrap(<QuickAdd />);

  await openModal();
  const remembered = await screen.findByRole("button", { name: "Giao tiếp" });
  expect(remembered).toHaveAttribute("aria-pressed", "true");
});

test("falls back to the first deck when the stored deck no longer exists", async () => {
  localStorage.setItem("quick-add-deck", "99");
  stubApi();
  wrap(<QuickAdd />);

  await openModal();
  const first = await screen.findByRole("button", { name: "IELTS" });
  expect(first).toHaveAttribute("aria-pressed", "true");
});

test("initialDeckId (deck card) wins over the remembered deck", async () => {
  localStorage.setItem("quick-add-deck", "1");
  stubApi();
  wrap(<QuickAddModal initialDeckId={2} onClose={vi.fn()} />);

  const preset = await screen.findByRole("button", { name: "Giao tiếp" });
  expect(preset).toHaveAttribute("aria-pressed", "true");
});

test("adds a word, stays open for the next one, lists it under Vừa thêm", async () => {
  const fetchMock = stubApi();
  wrap(<QuickAdd />);

  await openModal();
  fireEvent.click(await screen.findByRole("button", { name: "Giao tiếp" }));
  fireEvent.change(screen.getByLabelText("Từ mới"), { target: { value: "  hello  " } });
  fireEvent.click(screen.getByRole("button", { name: /Thêm từ$/ }));

  // The added word appears in the list, still enriching.
  expect(await screen.findByText("hello")).toBeInTheDocument();
  expect(screen.getByText("đang tra cứu…")).toBeInTheDocument();

  // The modal stays open with a cleared, ready input for the next word.
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("Từ mới")).toHaveValue("");

  const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
  expect(String(post?.[0])).toBe("/api/v1/decks/2/words");
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ word: "hello" });
  expect(localStorage.getItem("quick-add-deck")).toBe("2");
});

test("shows the AI result in the Vừa thêm row once enrichment completes", async () => {
  stubApi({
    wordOverrides: { enrichment_status: "completed", ipa: "/həˈloʊ/", meaning_vi: "xin chào" },
  });
  wrap(<QuickAdd />);

  await openModal();
  await screen.findByRole("button", { name: "IELTS" });
  fireEvent.change(screen.getByLabelText("Từ mới"), { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: /Thêm từ$/ }));

  expect(await screen.findByText("hello")).toBeInTheDocument();
  expect(screen.getByText(/xin chào/)).toBeInTheDocument();
  expect(screen.queryByText("đang tra cứu…")).not.toBeInTheDocument();
});

test("shows the duplicate-word error inside the modal and keeps the input", async () => {
  stubApi({
    onAddWord: () => json({ detail: "Word already exists.", code: "word_conflict" }, 409),
  });
  wrap(<QuickAdd />);

  await openModal();
  await screen.findByRole("button", { name: "IELTS" });
  fireEvent.change(screen.getByLabelText("Từ mới"), { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: /Thêm từ$/ }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Từ này đã có trong deck.");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("Từ mới")).toHaveValue("hello");
});

test("without any deck it points to deck creation instead of the form", async () => {
  stubApi({ decks: { count: 0, next: null, previous: null, results: [] } });
  wrap(<QuickAdd />);

  await openModal();
  expect(await screen.findByRole("link", { name: "Tạo deck đầu tiên" })).toHaveAttribute(
    "href",
    "/decks",
  );
  expect(screen.queryByLabelText("Từ mới")).not.toBeInTheDocument();
});
