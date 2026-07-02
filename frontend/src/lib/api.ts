/**
 * API client with in-memory access token and silent refresh (SPEC §6.6).
 *
 * The access token lives only in module memory — never persisted — so a page
 * reload restores the session through the httpOnly refresh cookie instead.
 * Every error response from the backend has the shape {detail, code} and is
 * surfaced as ApiError; callers branch on `code`, never on the message.
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    return new ApiError(
      response.status,
      body.code ?? "error",
      body.detail ?? "Request failed.",
      body.errors,
    );
  } catch {
    return new ApiError(response.status, "error", "Request failed.");
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Exchange the refresh cookie for a new access token.
 * Concurrent callers share a single in-flight request.
 */
export function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch("/api/v1/auth/refresh", { method: "POST" });
      if (!response.ok) {
        setAccessToken(null);
        return false;
      }
      const body: { access: string } = await response.json();
      setAccessToken(body.access);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function requestWithAuth(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}

/** Fetch a JSON endpoint; on 401 try one silent refresh, then retry once. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await requestWithAuth(path, init);
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) response = await requestWithAuth(path, init);
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
