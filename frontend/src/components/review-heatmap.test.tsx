import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { DailyPoint } from "@/lib/stats";

import { ReviewHeatmap } from "./review-heatmap";

/** `days` contiguous days ending 2026-07-10, zero-filled like the API. */
function yearOfPoints(days: number, counts: Record<string, number> = {}): DailyPoint[] {
  const end = Date.UTC(2026, 6, 10);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, count: counts[date] ?? 0 };
  });
}

function cells(container: HTMLElement) {
  return container.querySelectorAll("svg[role='img'] rect");
}

test("renders one cell per day", () => {
  const { container } = render(<ReviewHeatmap points={yearOfPoints(365)} />);
  expect(cells(container)).toHaveLength(365);
});

test("empty days are level 0, busiest day is level 4, hover shows the count", () => {
  const points = yearOfPoints(365, { "2026-07-09": 2, "2026-07-10": 8 });
  const { container } = render(<ReviewHeatmap points={points} />);

  const byLevel = (level: string) =>
    container.querySelectorAll(`svg[role='img'] rect[data-level='${level}']`);
  expect(byLevel("0")).toHaveLength(363);
  expect(byLevel("4")).toHaveLength(1); // 8/8 → top intensity
  expect(byLevel("1")).toHaveLength(1); // 2/8 → faintest filled level

  // Native SVG <title> tooltips carry the exact numbers (AC §17.2-12).
  expect(screen.getByText("8 lượt ôn · 10/7/2026")).toBeInTheDocument();
  expect(screen.getByText("0 lượt ôn · 8/7/2026")).toBeInTheDocument();
});

test("weekday rows follow a Monday-first grid", () => {
  // 2026-07-10 is a Friday → row 4 in a Monday-first grid.
  // The only reviewed day is also the busiest one, so it gets level 4.
  const points = yearOfPoints(365, { "2026-07-10": 1 });
  const { container } = render(<ReviewHeatmap points={points} />);

  const filled = container.querySelector("svg[role='img'] rect[data-level='4']");
  const emptyAbove = Array.from(cells(container)).filter(
    (rect) => rect.getAttribute("x") === filled?.getAttribute("x"),
  );
  // Friday sits mid-column: same week has Monday–Thursday above it.
  expect(emptyAbove.indexOf(filled as Element)).toBe(4);
});

test("labels months and the legend ends", () => {
  render(<ReviewHeatmap points={yearOfPoints(365)} />);
  expect(screen.getAllByText(/^Thg \d+$/).length).toBeGreaterThanOrEqual(12);
  expect(screen.getByText("Ít")).toBeInTheDocument();
  expect(screen.getByText("Nhiều")).toBeInTheDocument();
});
