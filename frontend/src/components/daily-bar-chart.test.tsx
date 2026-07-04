import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import type { DailyPoint } from "@/lib/stats";

import { DailyBarChart } from "./daily-bar-chart";

function barTitles(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll("title")).map((t) => t.textContent);
}

test("renders one bar per day with a date/count title", () => {
  const points: DailyPoint[] = [
    { date: "2026-07-08", count: 1 },
    { date: "2026-07-09", count: 0 },
    { date: "2026-07-10", count: 4 },
  ];
  const { container } = render(<DailyBarChart points={points} />);

  expect(container.querySelectorAll("rect")).toHaveLength(3);
  expect(barTitles(container)).toContain("2026-07-10: 4 thẻ");
  expect(barTitles(container)).toContain("2026-07-09: 0 thẻ");
});

test("scales bar height relative to the max count", () => {
  const points: DailyPoint[] = [
    { date: "2026-07-08", count: 5 }, // max → full height 100
    { date: "2026-07-09", count: 0 }, // → height 0
  ];
  const { container } = render(<DailyBarChart points={points} />);

  const [tallest, empty] = Array.from(container.querySelectorAll("rect"));
  expect(tallest.getAttribute("height")).toBe("100");
  expect(empty.getAttribute("height")).toBe("0");
});

test("does not divide by zero when every day is empty", () => {
  const points: DailyPoint[] = [
    { date: "2026-07-09", count: 0 },
    { date: "2026-07-10", count: 0 },
  ];
  const { container } = render(<DailyBarChart points={points} />);

  const rects = Array.from(container.querySelectorAll("rect"));
  expect(rects.every((r) => r.getAttribute("height") === "0")).toBe(true);
});
