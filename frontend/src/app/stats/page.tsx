"use client";

import { DailyBarChart } from "@/components/daily-bar-chart";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <PageHeader title="Thống kê" backHref="/" backLabel="← Trang chủ" />

      {overview.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : overview.isError ? (
        <p className="text-grade-again text-sm">Không tải được thống kê.</p>
      ) : (
        <Overview data={overview.data} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">
          Số thẻ đã ôn ({DAILY_WINDOW} ngày gần nhất)
        </h2>
        {daily.isPending ? (
          <p className="text-muted-fg text-sm">Đang tải…</p>
        ) : daily.isError ? (
          <p className="text-grade-again text-sm">Không tải được biểu đồ.</p>
        ) : (
          <DailyBarChart points={daily.data.results} />
        )}
      </section>
    </main>
  );
}

function Overview({ data }: { data: StatsOverview }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-streak/10 border-streak/20 flex items-center gap-3 rounded-2xl border p-4">
        <FlameIcon />
        <p className="text-lg">
          Streak: <span className="font-display font-bold">{data.streak}</span> ngày · Đã ôn hôm
          nay: <span className="font-display font-bold">{data.reviewed_today}</span> thẻ
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Từ mới" value={data.new} tint="bg-surface-2" valueClass="text-fg" />
        <StatCard
          label="Đang học"
          value={data.learning}
          tint="bg-streak/10"
          valueClass="text-streak"
        />
        <StatCard
          label="Thành thạo"
          value={data.mastered}
          tint="bg-accent/10"
          valueClass="text-accent"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tint,
  valueClass,
}: {
  label: string;
  value: number;
  tint: string;
  valueClass: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl p-4 ${tint}`}>
      <span className={`font-display text-3xl font-bold ${valueClass}`}>{value}</span>
      <span className="text-muted-fg text-sm">{label}</span>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-streak shrink-0"
      aria-hidden="true"
    >
      <path d="M12 2s4 3.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.5-2.3C7 8.5 6 10.2 6 12.5a6 6 0 1 0 12 0c0-4.8-3.6-8.5-6-10.5Z" />
    </svg>
  );
}
