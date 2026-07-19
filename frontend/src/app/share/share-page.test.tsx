import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setAccessToken } from "@/lib/api";
import { AuthProvider } from "@/lib/auth-context";

import { ShareContent } from "./[id]/page";

const PUBLIC_DECK = {
  id: 99,
  name: "IELTS Core",
  description: "Bộ từ luyện IELTS.",
  owner_name: "Bảo",
  word_count: 1,
};

const WORDS_PAGE = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      word_text: "ubiquitous",
      part_of_speech: "adjective",
      ipa: "/juːˈbɪkwɪtəs/",
      meaning_vi: "có mặt khắp nơi",
      example_en: "Smartphones are ubiquitous today.",
      example_vi: "Điện thoại thông minh có mặt khắp nơi ngày nay.",
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetchRoutes(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const route = routes[String(input)];
    if (!route) throw new Error(`Unexpected fetch: ${String(input)}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderShare() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ShareContent deckId={99} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => setAccessToken(null));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a guest sees the deck, its words and a login CTA", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () => jsonResponse(401, { detail: "no", code: "token_not_valid" }),
    "/api/v1/decks/99/public": () => jsonResponse(200, PUBLIC_DECK),
    "/api/v1/decks/99/public/words?page=1": () => jsonResponse(200, WORDS_PAGE),
  });
  renderShare();

  expect(await screen.findByText("IELTS Core")).toBeInTheDocument();
  expect(screen.getByText("Bảo")).toBeInTheDocument();
  expect(await screen.findByText("ubiquitous")).toBeInTheDocument();
  expect(screen.getByText("có mặt khắp nơi")).toBeInTheDocument();

  const cta = await screen.findByRole("link", { name: /Đăng nhập để thêm về tài khoản/ });
  expect(cta).toHaveAttribute("href", "/login");
});

test("a private or missing deck shows the friendly not-found state", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () => jsonResponse(401, { detail: "no", code: "token_not_valid" }),
    "/api/v1/decks/99/public": () => jsonResponse(404, { detail: "Not found.", code: "not_found" }),
  });
  renderShare();

  expect(
    await screen.findByText("Deck này không tồn tại hoặc không còn công khai."),
  ).toBeInTheDocument();
});

test("a logged-in user clones the deck from the share page", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () => jsonResponse(200, { access: "token" }),
    "/api/v1/me": () =>
      jsonResponse(200, { id: 7, email: "x@y.z", display_name: "Khách", avatar_url: "" }),
    "/api/v1/decks/99/public": () => jsonResponse(200, PUBLIC_DECK),
    "/api/v1/decks/99/public/words?page=1": () => jsonResponse(200, WORDS_PAGE),
    "/api/v1/decks/99/clone": () => jsonResponse(201, { ...PUBLIC_DECK, id: 12, source_deck: 99 }),
  });
  renderShare();

  fireEvent.click(await screen.findByRole("button", { name: /Thêm về tài khoản/ }));

  await waitFor(() => expect(screen.getByText(/Đã thêm về tài khoản của bạn/)).toBeInTheDocument());
  expect(screen.getByRole("link", { name: /Xem bộ từ của tôi/ })).toHaveAttribute("href", "/decks");
});
