"use client";

import Link from "next/link";

import { DeckIcon } from "@/components/deck-icon";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { useDecks } from "@/lib/decks";
import { useReviewQueue } from "@/lib/review";
import { useStatsOverview } from "@/lib/stats";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function HomeContent() {
  const { user } = useAuth();
  const overview = useStatsOverview();

  // Vietnamese name order: the given name is the last token.
  const name = user?.display_name?.trim().split(/\s+/).pop() || user?.email || "";
  const streak = overview.data?.streak;

  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-9 px-4 py-10 sm:px-8">
      <div className="animate-card-in">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {greeting()}, {name}
        </h1>
        <p className="text-muted-fg mt-2 text-base">
          {streak
            ? `Giữ vững chuỗi ${streak} ngày — hôm nay chỉ cần vài phút thôi.`
            : "Hôm nay chỉ cần vài phút thôi."}
        </p>
      </div>

      <div className="animate-card-in grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <ReviewHero />
        <ProgressCard />
      </div>

      <DecksSection />
    </main>
  );
}

function ReviewHero() {
  const queue = useReviewQueue();
  const summary = queue.data
    ? `${queue.data.due.length} thẻ đến hạn · ${queue.data.new.length} từ mới`
    : "Đang tải…";

  return (
    <section className="from-primary-hover to-(--primary-shadow) shadow-[0_12px_32px_rgba(88,204,2,0.3)] relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-gradient-to-br p-7 text-white">
      <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/12" aria-hidden />
      <div className="absolute right-10 -bottom-16 h-36 w-36 rounded-full bg-white/8" aria-hidden />
      <div>
        <p className="text-[13px] font-bold tracking-[.12em] text-white/80 uppercase">
          Ôn tập hôm nay
        </p>
        <p className="font-display mt-2.5 text-3xl font-extrabold tracking-tight">{summary}</p>
      </div>
      <Link
        href="/review"
        className="text-primary-text shadow-[0_4px_0_rgba(0,0,0,0.18)] z-[1] self-start rounded-full bg-white px-6 py-3 text-[15px] font-extrabold transition-transform hover:-translate-y-px active:translate-y-[2px] active:shadow-[0_1px_0_rgba(0,0,0,0.18)]"
      >
        Bắt đầu ôn tập →
      </Link>
    </section>
  );
}

function ProgressCard() {
  const overview = useStatsOverview();

  const rows = overview.data
    ? [
        { label: "Từ mới", value: overview.data.new, dot: "bg-subtle-fg" },
        { label: "Đang học", value: overview.data.learning, dot: "bg-streak" },
        { label: "Thành thạo", value: overview.data.mastered, dot: "bg-primary" },
      ]
    : null;

  return (
    <section className="glass flex flex-col gap-4 rounded-3xl p-6">
      <p className="text-subtle-fg text-[13px] font-bold tracking-[.12em] uppercase">
        Tiến độ của bạn
      </p>
      {rows ? (
        rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-fg flex items-center gap-2.5 text-sm font-semibold">
              <span className={`h-2.5 w-2.5 rounded-[3px] ${row.dot}`} aria-hidden />
              {row.label}
            </span>
            <span className="font-display text-lg font-bold">{row.value}</span>
          </div>
        ))
      ) : (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      )}
      <Link
        href="/stats"
        className="text-primary-text mt-auto self-start text-sm font-bold hover:underline"
      >
        Xem thống kê →
      </Link>
    </section>
  );
}

function DecksSection() {
  const decks = useDecks();

  return (
    <section className="animate-card-in flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-bold tracking-tight">Bộ từ vựng của bạn</h2>
        <Link href="/decks" className="text-primary-text text-sm font-bold hover:underline">
          Tất cả →
        </Link>
      </div>
      {decks.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : decks.isError ? (
        <p className="text-danger-text text-sm">Không tải được danh sách deck.</p>
      ) : decks.data.results.length === 0 ? (
        <p className="text-muted-fg text-sm">
          Bạn chưa có deck nào.{" "}
          <Link href="/decks" className="text-primary-text font-bold hover:underline">
            Tạo deck đầu tiên →
          </Link>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.data.results.slice(0, 3).map((deck) => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="glass hover:shadow-[0_12px_28px_rgba(88,204,2,0.18)] flex flex-col gap-3 rounded-[20px] p-5 transition-[box-shadow,transform] hover:-translate-y-0.5"
            >
              <DeckIcon deckId={deck.id} className="h-[42px] w-[42px] rounded-[13px]" />
              <span className="font-bold">{deck.name}</span>
              <span className="text-muted-fg text-[13px]">
                {deck.word_count} từ · {deck.mastered_count} thành thạo
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
