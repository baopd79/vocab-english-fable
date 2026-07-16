import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { Deck } from "@/lib/decks";

import { DecksContent } from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deck(id: number, name: string, overrides: Partial<Deck> = {}): Deck {
  return {
    id,
    name,
    description: "",
    visibility: "private",
    is_starter: false,
    source_deck: null,
    word_count: 0,
    mastered_count: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function paginated(results: Deck[]) {
  return { count: results.length, next: null, previous: null, results };
}

const STARTER = deck(99, "4000 Essential Words — Book 1", {
  is_starter: true,
  word_count: 600,
  description: "600 từ vựng nền tảng.",
});

/** Stub server: `mine` is mutable — the clone POST appends the cloned deck. */
function stubDeckServer(mine: Deck[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/decks" && method === "GET") return jsonResponse(200, paginated(mine));
    if (url === "/api/v1/decks/starter" && method === "GET")
      return jsonResponse(200, paginated([STARTER]));
    if (url === "/api/v1/decks/99/clone" && method === "POST") {
      const clone = deck(7, STARTER.name, { source_deck: 99, word_count: 600 });
      mine.push(clone);
      return jsonResponse(201, clone);
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDecks() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DecksContent />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("starter section lists the system deck and cloning hides it", async () => {
  stubDeckServer([deck(1, "Deck của tôi")]);
  renderDecks();

  // Section shows the starter deck with its size.
  expect(await screen.findByText("Deck mẫu")).toBeInTheDocument();
  expect(screen.getByText("4000 Essential Words — Book 1")).toBeInTheDocument();
  expect(screen.getByText("600 từ")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Thêm về tài khoản/ }));

  // The clone lands in my decks and the starter card disappears
  // (source_deck=99 now present in the refetched list).
  await waitFor(() => expect(screen.queryByText("Deck mẫu")).not.toBeInTheDocument());
  expect(screen.getAllByText("4000 Essential Words — Book 1")).toHaveLength(1); // my copy
});

test("starter section is hidden when the deck was already cloned", async () => {
  stubDeckServer([deck(7, "4000 Essential Words — Book 1", { source_deck: 99 })]);
  renderDecks();

  await screen.findByText("4000 Essential Words — Book 1"); // my cloned copy renders
  expect(screen.queryByText("Deck mẫu")).not.toBeInTheDocument();
});
