"use client";

import type { DailyPoint } from "@/lib/stats";

const CHART_HEIGHT = 100;
const BAR_WIDTH = 10;
const GAP = 2;

/** Lightweight SVG bar chart — no chart library. Each bar carries a <title>
 * so hovering (and tests) can read the exact date and count. The most recent
 * day (today) is highlighted in the streak orange. */
export function DailyBarChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = BAR_WIDTH + GAP;
  const width = points.length * step;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
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
                className={
                  index === points.length - 1 ? "fill-streak" : "fill-primary hover:brightness-110"
                }
              >
                <title>{`${point.date}: ${point.count} thẻ`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="text-subtle-fg flex justify-between text-xs">
        <span>{points.length} ngày trước</span>
        <span>Hôm nay</span>
      </div>
    </div>
  );
}
