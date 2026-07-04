import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { useWord, type UserWord } from "./words";

function word(overrides: Partial<UserWord>): UserWord {
  return {
    id: 1,
    deck: 1,
    word_text: "hello",
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

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("useWord polls every 2s while pending and stops once completed", async () => {
  vi.useFakeTimers();
  const responses = [
    word({ enrichment_status: "pending" }),
    word({ enrichment_status: "completed", meaning_vi: "lời chào" }),
  ];
  const fetchMock = vi.fn(async () => {
    const body = responses.length > 1 ? responses.shift()! : responses[0];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useWord(1), { wrapper });

  // Initial fetch → pending.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(result.current.data?.enrichment_status).toBe("pending");

  // Pending → the hook schedules a refetch 2s later, which returns completed.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  // React Query commits the refetched data on a follow-up tick.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.data?.enrichment_status).toBe("completed");
  expect(result.current.data?.meaning_vi).toBe("lời chào");

  // Completed → polling stops.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("useWord does not poll when the word is already completed", async () => {
  vi.useFakeTimers();
  const completed = word({ enrichment_status: "completed" });
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(completed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  renderHook(() => useWord(1, completed), { wrapper });

  // A refetch-on-mount may happen (initialData is immediately stale)…
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  const callsAfterMount = fetchMock.mock.calls.length;

  // …but no interval polling follows for a completed word.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(callsAfterMount);
});
