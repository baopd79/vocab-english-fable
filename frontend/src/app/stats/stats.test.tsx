import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { DailyPoint, StatsOverview } from "@/lib/stats";

import { StatsContent } from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubStatsServer(overview: StatsOverview, daily: DailyPoint[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/v1/stats/overview") return jsonResponse(200, overview);
    if (url.startsWith("/api/v1/stats/daily")) return jsonResponse(200, { results: daily });
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

function renderStats() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StatsContent />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("shows overview counts, streak and the daily chart", async () => {
  stubStatsServer({ new: 12, learning: 8, mastered: 5, streak: 4, reviewed_today: 7 }, [
    { date: "2026-07-09", count: 3 },
    { date: "2026-07-10", count: 7 },
  ]);
  const { container } = renderStats();

  // Streak + reviewed today (one line holds both numbers).
  const streakLine = await screen.findByText(/Chuỗi/);
  expect(streakLine).toHaveTextContent("4");
  expect(streakLine).toHaveTextContent("7");

  // Word-state cards.
  expect(screen.getByText("Từ mới").previousSibling).toHaveTextContent("12");
  expect(screen.getByText("Đang học").previousSibling).toHaveTextContent("8");
  expect(screen.getByText("Thành thạo").previousSibling).toHaveTextContent("5");

  // Chart bars from the daily data.
  await waitFor(() => {
    const titles = Array.from(container.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles).toContain("2026-07-10: 7 thẻ");
  });
});
