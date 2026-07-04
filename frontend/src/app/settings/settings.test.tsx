import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { UserSettings } from "@/lib/settings";

import { SettingsContent } from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const DEFAULTS: UserSettings = {
  new_words_per_day: 10,
  max_reviews_per_day: 200,
  timezone: "Asia/Ho_Chi_Minh",
};

function stubSettingsServer(initial: UserSettings = DEFAULTS, { rejectPatch = false } = {}) {
  let settings = { ...initial };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/me/settings" && method === "GET") {
      return jsonResponse(200, settings);
    }
    if (url === "/api/v1/me/settings" && method === "PATCH") {
      if (rejectPatch) {
        return jsonResponse(400, {
          detail: "Invalid input.",
          code: "validation_error",
          errors: { new_words_per_day: ["Ensure this value is <= 100."] },
        });
      }
      settings = { ...settings, ...JSON.parse(init!.body as string) };
      return jsonResponse(200, settings);
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { current: () => settings };
}

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsContent />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("loads current settings into the form", async () => {
  stubSettingsServer();
  renderSettings();
  expect(await screen.findByLabelText("Từ mới mỗi ngày")).toHaveValue(10);
  expect(screen.getByLabelText("Số lượt ôn tối đa mỗi ngày")).toHaveValue(200);
  expect(screen.getByLabelText("Múi giờ")).toHaveValue("Asia/Ho_Chi_Minh");
});

test("saves updated settings and confirms", async () => {
  const server = stubSettingsServer();
  renderSettings();

  const newPerDay = await screen.findByLabelText("Từ mới mỗi ngày");
  fireEvent.change(newPerDay, { target: { value: "25" } });
  fireEvent.change(screen.getByLabelText("Múi giờ"), { target: { value: "Asia/Tokyo" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

  expect(await screen.findByText("Đã lưu.")).toBeInTheDocument();
  expect(server.current().new_words_per_day).toBe(25);
  expect(server.current().timezone).toBe("Asia/Tokyo");
});

test("client-side max blocks submitting an out-of-range value", async () => {
  const server = stubSettingsServer();
  renderSettings();

  const newPerDay = await screen.findByLabelText("Từ mới mỗi ngày");
  fireEvent.change(newPerDay, { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

  // The number input's max=100 fails HTML5 validation, so no PATCH is sent.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(server.current().new_words_per_day).toBe(10);
  expect(screen.queryByText("Đã lưu.")).not.toBeInTheDocument();
});

test("shows a validation error when the server rejects a valid-looking value", async () => {
  stubSettingsServer(DEFAULTS, { rejectPatch: true });
  renderSettings();

  const newPerDay = await screen.findByLabelText("Từ mới mỗi ngày");
  fireEvent.change(newPerDay, { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/không hợp lệ/i);
  expect(screen.queryByText("Đã lưu.")).not.toBeInTheDocument();
});
