"use client";

import Link from "next/link";

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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thống kê</h1>
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← Trang chủ
        </Link>
      </header>

      {overview.isPending ? (
        <p className="text-sm text-gray-600">Đang tải…</p>
      ) : overview.isError ? (
        <p className="text-sm text-red-600">Không tải được thống kê.</p>
      ) : (
        <Overview data={overview.data} />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Số thẻ đã ôn ({DAILY_WINDOW} ngày gần nhất)</h2>
        {daily.isPending ? (
          <p className="text-sm text-gray-600">Đang tải…</p>
        ) : daily.isError ? (
          <p className="text-sm text-red-600">Không tải được biểu đồ.</p>
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
      <p className="text-lg">
        🔥 Streak: <span className="font-bold">{data.streak}</span> ngày · Đã ôn hôm nay:{" "}
        <span className="font-bold">{data.reviewed_today}</span> thẻ
      </p>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Từ mới" value={data.new} className="bg-gray-100" />
        <StatCard label="Đang học" value={data.learning} className="bg-amber-100" />
        <StatCard label="Thành thạo" value={data.mastered} className="bg-green-100" />
      </div>
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
    <div className={`flex flex-col items-center gap-1 rounded p-4 ${className}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}
