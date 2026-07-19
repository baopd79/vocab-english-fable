import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { DeckWordsContent } from "./page";

const PRIVATE_DECK = {
  id: 5,
  name: "Deck của tôi",
  description: "",
  visibility: "private",
  is_starter: false,
  source_deck: null,
  word_count: 0,
  mastered_count: 0,
  created_at: "",
  updated_at: "",
};

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("share panel toggles the deck public and reveals the share link", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/decks/5" && method === "GET") return jsonResponse(200, PRIVATE_DECK);
    if (url === "/api/v1/decks/5/words" && method === "GET") return jsonResponse(200, EMPTY_PAGE);
    if (url === "/api/v1/decks/5" && method === "PATCH") {
      expect(JSON.parse(String(init?.body))).toEqual({ visibility: "public" });
      return jsonResponse(200, { ...PRIVATE_DECK, visibility: "public" });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DeckWordsContent deckId={5} />
    </QueryClientProvider>,
  );

  // The panel opens on "Chia sẻ" and offers to go public.
  fireEvent.click(await screen.findByRole("button", { name: /Chia sẻ/ }));
  expect(screen.getByText("Deck đang riêng tư")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Bật công khai" }));

  // The PATCH lands in the cache: the panel flips and shows the link.
  await waitFor(() => expect(screen.getByText("Deck đang công khai")).toBeInTheDocument());
  expect(screen.getByText(/\/share\/5$/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tắt công khai" })).toBeInTheDocument();
});
