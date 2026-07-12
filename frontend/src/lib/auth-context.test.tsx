import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setAccessToken } from "./api";
import { AuthProvider, useAuth } from "./auth-context";

const USER = {
  id: 1,
  email: "learner@example.com",
  display_name: "Learner One",
  avatar_url: "",
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

// Fresh QueryClient per test, like providers.tsx wires it above AuthProvider.
let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  setAccessToken(null);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("restores the session on mount when the refresh cookie is valid", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () => jsonResponse(200, { access: "token-restored" }),
    "/api/v1/me": () => jsonResponse(200, USER),
  });

  const { result } = renderHook(() => useAuth(), { wrapper });

  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  expect(result.current.user).toEqual(USER);
});

test("becomes unauthenticated when there is no valid refresh cookie", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () =>
      jsonResponse(401, { detail: "missing", code: "refresh_cookie_missing" }),
  });

  const { result } = renderHook(() => useAuth(), { wrapper });

  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  expect(result.current.user).toBeNull();
});

test("loginWithGoogle exchanges the credential and loads the profile", async () => {
  const fetchMock = stubFetchRoutes({
    "/api/v1/auth/refresh": () =>
      jsonResponse(401, { detail: "missing", code: "refresh_cookie_missing" }),
    "/api/v1/auth/google": () => jsonResponse(200, { access: "token-login" }),
    "/api/v1/me": () => jsonResponse(200, USER),
  });

  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

  await act(() => result.current.loginWithGoogle("google-credential"));

  expect(result.current.status).toBe("authenticated");
  expect(result.current.user).toEqual(USER);
  const googleCall = fetchMock.mock.calls.find(
    ([input]) => String(input) === "/api/v1/auth/google",
  );
  expect(JSON.parse((googleCall?.[1] as RequestInit).body as string)).toEqual({
    credential: "google-credential",
  });
});

test("logout clears the session even if the API call fails", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () => jsonResponse(200, { access: "token-restored" }),
    "/api/v1/me": () => jsonResponse(200, USER),
    "/api/v1/auth/logout": () => jsonResponse(500, { detail: "boom", code: "error" }),
  });

  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));

  await act(() => result.current.logout());

  expect(result.current.status).toBe("unauthenticated");
  expect(result.current.user).toBeNull();
});

test("logout clears the query cache so the next account starts clean", async () => {
  stubFetchRoutes({
    "/api/v1/auth/refresh": () => jsonResponse(200, { access: "token-restored" }),
    "/api/v1/me": () => jsonResponse(200, USER),
    "/api/v1/auth/logout": () => new Response(null, { status: 204 }),
  });

  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  queryClient.setQueryData(["decks"], [{ id: 1, name: "Bộ từ của tài khoản A" }]);

  await act(() => result.current.logout());

  expect(queryClient.getQueryData(["decks"])).toBeUndefined();
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

test("loginWithGoogle clears cache left over from a dead session", async () => {
  // The 401 path: the old session expires (no logout() call), the user lands on
  // /login and signs in as a different account — the old cache must not survive.
  stubFetchRoutes({
    "/api/v1/auth/refresh": () =>
      jsonResponse(401, { detail: "missing", code: "refresh_cookie_missing" }),
    "/api/v1/auth/google": () => jsonResponse(200, { access: "token-login" }),
    "/api/v1/me": () => jsonResponse(200, USER),
  });

  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  queryClient.setQueryData(["decks"], [{ id: 1, name: "Bộ từ của tài khoản A" }]);

  await act(() => result.current.loginWithGoogle("google-credential"));

  expect(result.current.status).toBe("authenticated");
  expect(queryClient.getQueryData(["decks"])).toBeUndefined();
});
