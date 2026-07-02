import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api, ApiError, getAccessToken, refreshSession, setAccessToken } from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("attaches the in-memory access token as a Bearer header", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" }));
  vi.stubGlobal("fetch", fetchMock);
  setAccessToken("token-1");

  await api("/api/v1/me");

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
});

test("on 401 refreshes silently and retries once with the new token", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/v1/auth/refresh") {
      return jsonResponse(200, { access: "token-new" });
    }
    const auth = new Headers(init?.headers).get("Authorization");
    return auth === "Bearer token-new"
      ? jsonResponse(200, { email: "learner@example.com" })
      : jsonResponse(401, { detail: "expired", code: "token_not_valid" });
  });
  vi.stubGlobal("fetch", fetchMock);
  setAccessToken("token-expired");

  const data = await api<{ email: string }>("/api/v1/me");

  expect(data.email).toBe("learner@example.com");
  expect(getAccessToken()).toBe("token-new");
});

test("when the refresh also fails, throws ApiError and clears the token", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(401, { detail: "dead session", code: "token_not_valid" }),
  );
  vi.stubGlobal("fetch", fetchMock);
  setAccessToken("token-expired");

  await expect(api("/api/v1/me")).rejects.toMatchObject({
    name: "ApiError",
    status: 401,
    code: "token_not_valid",
  });
  expect(getAccessToken()).toBeNull();
});

test("surfaces field errors from validation responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/api/v1/auth/refresh"
        ? jsonResponse(401, { detail: "no cookie", code: "refresh_cookie_missing" })
        : jsonResponse(400, {
            detail: "Invalid input.",
            code: "validation_error",
            errors: { credential: ["This field is required."] },
          }),
    ),
  );

  const error = await api("/api/v1/auth/google", { method: "POST", body: "{}" }).catch(
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe("validation_error");
  expect((error as ApiError).errors).toEqual({ credential: ["This field is required."] });
});

test("concurrent refreshSession calls share one request", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { access: "token-shared" }));
  vi.stubGlobal("fetch", fetchMock);

  const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

  expect(first).toBe(true);
  expect(second).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getAccessToken()).toBe("token-shared");
});

test("returns undefined for 204 responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  setAccessToken("token-1");

  await expect(api<void>("/api/v1/auth/logout", { method: "POST" })).resolves.toBeUndefined();
});
