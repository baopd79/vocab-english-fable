"use client";

import { DailyBarChart } from "@/components/daily-bar-chart";
import { RequireAuth } from "@/components/require-auth";
import { useDailyReviews, useStatsOverview, type StatsOverview } from "@/lib/stats";

const DAILY_WINDOW = 30;

export default function StatsPage() {
  return (
    <RequireAuth>
      <StatsContent />
    </RequireAuth>
  );
}

export function StatsContent() {
  const overview = useStatsOverview();
  const daily = useDailyReviews(DAILY_WINDOW);

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-7 px-4 py-10 sm:px-8">
      <header className="animate-card-in">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Thống kê</h1>
        {overview.data && (
          <p className="text-muted-fg mt-2 flex items-center gap-1.5 text-base">
            <FlameIcon />
            Chuỗi <strong className="text-fg">{overview.data.streak} ngày</strong> liên tiếp · Hôm
            nay đã ôn <strong className="text-fg">{overview.data.reviewed_today} thẻ</strong>
          </p>
        )}
      </header>

      {overview.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : overview.isError ? (
        <p className="text-danger-text text-sm">Không tải được thống kê.</p>
      ) : (
        <Overview data={overview.data} />
      )}

      <section className="glass animate-card-in flex flex-col gap-4 rounded-[22px] p-6 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Số thẻ đã ôn ({DAILY_WINDOW} ngày gần nhất)
        </h2>
        {daily.isPending ? (
          <p className="text-muted-fg text-sm">Đang tải…</p>
        ) : daily.isError ? (
          <p className="text-danger-text text-sm">Không tải được biểu đồ.</p>
        ) : (
          <DailyBarChart points={daily.data.results} />
        )}
      </section>
    </main>
  );
}

function Overview({ data }: { data: StatsOverview }) {
  return (
    <div className="animate-card-in grid grid-cols-3 gap-4">
      <StatCard
        label="Từ mới"
        value={data.new}
        className="bg-surface-2 border-chip-border text-muted-fg"
      />
      <StatCard
        label="Đang học"
        value={data.learning}
        className="bg-streak/15 border-streak/35 text-streak-text"
      />
      <StatCard
        label="Thành thạo"
        value={data.mastered}
        className="bg-primary/15 border-primary/40 text-primary-text"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-[20px] border-[1.5px] p-5 backdrop-blur-md ${className}`}
    >
      <span className="font-display text-4xl font-extrabold">{value}</span>
      <span className="text-muted-fg text-sm font-semibold">{label}</span>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-streak shrink-0"
      aria-hidden="true"
    >
      <path d="M12 22c4.4 0 7.5-3 7.5-7.2 0-2.9-1.6-5.3-3.3-7.2-.5-.6-1.5-.2-1.5.6 0 1.1-.3 2.2-1 3-.6-2.6-1.8-5.6-4.5-7.7-.6-.5-1.5 0-1.4.8.2 1.9-.5 3.7-1.6 5.4C4.9 11.5 4 13.5 4 15c0 4.1 3.6 7 8 7z" />
    </svg>
  );
}
