import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { setAccessToken } from "@/lib/api";
import type { Deck } from "@/lib/decks";

import { DecksContent } from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deck(id: number, name: string, description = ""): Deck {
  return { id, name, description, visibility: "private", created_at: "", updated_at: "" };
}

/** Minimal in-memory deck backend so mutations + refetch behave end-to-end. */
function stubDeckServer(initial: Deck[]) {
  let decks = [...initial];
  let nextId = 1000;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/decks" && method === "GET") {
      return jsonResponse(200, { count: decks.length, next: null, previous: null, results: decks });
    }
    if (url === "/api/v1/decks" && method === "POST") {
      const body = JSON.parse(init!.body as string);
      const created = deck(nextId++, body.name, body.description ?? "");
      decks.push(created);
      return jsonResponse(201, created);
    }
    const match = url.match(/\/api\/v1\/decks\/(\d+)$/);
    if (match && method === "DELETE") {
      decks = decks.filter((d) => d.id !== Number(match[1]));
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, current: () => decks };
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
  setAccessToken(null);
});

test("shows the empty state when there are no decks", async () => {
  stubDeckServer([]);
  renderDecks();
  expect(await screen.findByText(/chưa có deck nào/i)).toBeInTheDocument();
});

test("renders decks returned by the API", async () => {
  stubDeckServer([deck(1, "IELTS", "band 7"), deck(2, "Travel")]);
  renderDecks();

  expect(await screen.findByText("IELTS")).toBeInTheDocument();
  expect(screen.getByText("band 7")).toBeInTheDocument();
  expect(screen.getByText("Travel")).toBeInTheDocument();
});

test("creates a deck and shows it after refetch", async () => {
  const server = stubDeckServer([]);
  renderDecks();
  await screen.findByText(/chưa có deck nào/i);

  fireEvent.click(screen.getByRole("button", { name: "+ Tạo deck mới" }));
  fireEvent.change(screen.getByLabelText("Tên deck"), { target: { value: "IELTS" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo" }));

  expect(await screen.findByText("IELTS")).toBeInTheDocument();
  expect(server.current().map((d) => d.name)).toContain("IELTS");
});

test("deletes a deck after confirmation", async () => {
  const server = stubDeckServer([deck(1, "IELTS")]);
  renderDecks();
  await screen.findByText("IELTS");

  fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
  // Confirm step
  const confirm = screen.getByText(/Xóa deck/i).closest("div")!;
  fireEvent.click(within(confirm).getByRole("button", { name: "Xóa" }));

  await waitFor(() => expect(server.current()).toHaveLength(0));
  expect(screen.queryByText("IELTS")).not.toBeInTheDocument();
});
