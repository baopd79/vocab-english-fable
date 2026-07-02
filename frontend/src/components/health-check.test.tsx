import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { HealthCheck } from "./health-check";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("shows API status when health endpoint responds", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    }),
  );

  renderWithQuery(<HealthCheck />);

  expect(await screen.findByText("API: ok")).toBeInTheDocument();
});

test("shows error when health endpoint fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

  renderWithQuery(<HealthCheck />);

  expect(await screen.findByText("API: không kết nối được")).toBeInTheDocument();
});
