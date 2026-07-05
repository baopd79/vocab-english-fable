"use client";

import type { DailyPoint } from "@/lib/stats";

const CHART_HEIGHT = 100;
const BAR_WIDTH = 10;
const GAP = 2;

/** Lightweight SVG bar chart — no chart library. Each bar carries a <title>
 * so hovering (and tests) can read the exact date and count. */
export function DailyBarChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = BAR_WIDTH + GAP;
  const width = points.length * step;

  return (
    <div className="border-border bg-surface overflow-x-auto rounded-2xl border p-4 shadow-sm">
      <svg
        role="img"
        aria-label="Số thẻ đã ôn theo ngày"
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        className="h-40 w-full min-w-[480px]"
        preserveAspectRatio="none"
      >
        {points.map((point, index) => {
          const barHeight = (point.count / max) * CHART_HEIGHT;
          return (
            <rect
              key={point.date}
              x={index * step}
              y={CHART_HEIGHT - barHeight}
              width={BAR_WIDTH}
              height={barHeight}
              rx={2}
              className="fill-primary"
            >
              <title>{`${point.date}: ${point.count} thẻ`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
