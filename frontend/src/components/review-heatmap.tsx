"use client";

import type { DailyPoint } from "@/lib/stats";

/** GitHub-style review heatmap (SPEC §17.2-12): 365 days of review counts as
 * a pure-SVG week grid, Monday-first. Empty days stay faint; intensity is
 * relative to the user's own busiest day. Hover shows the exact count via
 * native SVG <title> tooltips. */

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const LEFT_GUTTER = 30; // weekday labels
const TOP_GUTTER = 18; // month labels

const WEEKDAY_LABELS: Record<number, string> = { 0: "T2", 2: "T4", 4: "T6" };

/** Monday-first row index (T2=0 … CN=6) without timezone surprises: the date
 * string is a plain local day, so parse it as UTC and read UTC fields. */
function mondayRow(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day}/${month}/${year}`;
}

function monthOf(isoDate: string): number {
  return Number(isoDate.split("-")[1]);
}

export function ReviewHeatmap({ points }: { points: DailyPoint[] }) {
  if (points.length === 0) return null;

  const startPad = mondayRow(points[0].date);
  const columns = Math.ceil((points.length + startPad) / 7);
  const max = Math.max(...points.map((p) => p.count));

  // Label a column with its month when it starts a new month.
  const monthLabels: { column: number; label: string }[] = [];
  for (let column = 0; column < columns; column++) {
    const firstIndex = Math.max(column * 7 - startPad, 0);
    const month = monthOf(points[firstIndex].date);
    const previous = monthLabels[monthLabels.length - 1];
    if (!previous || previous.label !== `Thg ${month}`) {
      monthLabels.push({ column, label: `Thg ${month}` });
    }
  }

  const width = LEFT_GUTTER + columns * PITCH;
  const height = TOP_GUTTER + 7 * PITCH;

  return (
    <div className="flex flex-col gap-3">
      <svg
        role="img"
        aria-label="Heatmap số lượt ôn 365 ngày qua"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {monthLabels.map(({ column, label }) => (
          <text
            key={column}
            x={LEFT_GUTTER + column * PITCH}
            y={11}
            className="fill-subtle-fg text-[10px] font-semibold"
          >
            {label}
          </text>
        ))}
        {Object.entries(WEEKDAY_LABELS).map(([row, label]) => (
          <text
            key={row}
            x={0}
            y={TOP_GUTTER + Number(row) * PITCH + CELL - 2}
            className="fill-subtle-fg text-[10px] font-semibold"
          >
            {label}
          </text>
        ))}
        {points.map((point, index) => {
          const slot = index + startPad;
          const level = point.count === 0 ? 0 : Math.max(1, Math.ceil((point.count / max) * 4));
          return (
            <rect
              key={point.date}
              data-level={level}
              x={LEFT_GUTTER + Math.floor(slot / 7) * PITCH}
              y={TOP_GUTTER + (slot % 7) * PITCH}
              width={CELL}
              height={CELL}
              rx={2.5}
              fill={level === 0 ? "var(--surface-2)" : "var(--primary)"}
              fillOpacity={level === 0 ? 1 : LEVEL_OPACITY[level]}
              stroke="var(--chip-border)"
              strokeWidth={0.75}
            >
              <title>{`${point.count} lượt ôn · ${formatDate(point.date)}`}</title>
            </rect>
          );
        })}
      </svg>
      <Legend />
    </div>
  );
}

const LEVEL_OPACITY: Record<number, number> = { 1: 0.3, 2: 0.55, 3: 0.78, 4: 1 };

function Legend() {
  return (
    <div className="text-subtle-fg flex items-center gap-1.5 text-xs font-semibold">
      <span>Ít</span>
      <svg width={5 * PITCH} height={CELL} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((level) => (
          <rect
            key={level}
            x={level * PITCH}
            width={CELL}
            height={CELL}
            rx={2.5}
            fill={level === 0 ? "var(--surface-2)" : "var(--primary)"}
            fillOpacity={level === 0 ? 1 : LEVEL_OPACITY[level]}
            stroke="var(--chip-border)"
            strokeWidth={0.75}
          />
        ))}
      </svg>
      <span>Nhiều</span>
    </div>
  );
}
