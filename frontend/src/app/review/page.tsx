"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DeckIcon } from "@/components/deck-icon";
import { ReviewCard } from "@/components/review-card";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-header";
import {
  isNewCard,
  useReviewQueue,
  useSubmitAnswer,
  type Rating,
  type ReviewQueue,
} from "@/lib/review";
import type { UserWord } from "@/lib/words";

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewContent />
    </RequireAuth>
  );
}

export function ReviewContent() {
  const queue = useReviewQueue();
  // Bumped by "Ôn thêm lượt nữa": remounts the runner over a refetched queue.
  const [round, setRound] = useState(0);
  // SPEC §17.1-B3 — /review lands on an overview; the session starts on click.
  const [started, setStarted] = useState(false);

  if (queue.isPending) {
    return <Centered>Đang tải…</Centered>;
  }
  if (queue.isError) {
    return <Centered>Không tải được danh sách ôn tập.</Centered>;
  }

  const cards = [...queue.data.due, ...queue.data.new];
  if (cards.length === 0) {
    return (
      <Centered>
        <p className="text-lg font-semibold">Hôm nay bạn không có thẻ nào cần ôn. 🎉</p>
        <HomeLink />
      </Centered>
    );
  }
  if (!started) {
    return <QueueOverview queue={queue.data} onStart={() => setStarted(true)} />;
  }
  return (
    <ReviewRunner
      key={round}
      initialCards={cards}
      onRestart={async () => {
        await queue.refetch();
        setRound((r) => r + 1);
      }}
    />
  );
}

function QueueOverview({ queue, onStart }: { queue: ReviewQueue; onStart: () => void }) {
  const dueCount = queue.due.length;
  const newCount = queue.new.length;
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <PageHeading
        title="Ôn tập hôm nay"
        subtitle="Xem qua khối lượng rồi bắt đầu khi bạn sẵn sàng."
      />

      <div className="animate-card-in grid grid-cols-2 gap-3">
        <div className="glass rounded-[18px] p-4 text-center">
          <p className="text-streak-text font-display text-3xl font-extrabold">{dueCount}</p>
          <p className="text-muted-fg text-sm font-semibold">thẻ đến hạn</p>
        </div>
        <div className="glass rounded-[18px] p-4 text-center">
          <p className="text-info-text font-display text-3xl font-extrabold">{newCount}</p>
          <p className="text-muted-fg text-sm font-semibold">thẻ mới</p>
        </div>
      </div>

      <ul className="animate-card-in flex flex-col gap-2.5">
        {queue.decks.map((deck) => (
          <li
            key={deck.deck_id}
            className="glass flex items-center justify-between gap-3 rounded-[18px] px-5 py-3.5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <DeckIcon deckId={deck.deck_id} className="h-9 w-9 rounded-[10px]" />
              <span className="truncate text-[15px] font-bold">{deck.deck_name}</span>
            </span>
            <span className="flex shrink-0 gap-2">
              {deck.due_count > 0 && <Badge variant="streak">{deck.due_count} đến hạn</Badge>}
              {deck.new_count > 0 && <Badge variant="info">{deck.new_count} mới</Badge>}
            </span>
          </li>
        ))}
      </ul>

      <Button size="lg" onClick={onStart} className="w-full">
        Bắt đầu ôn {dueCount + newCount} thẻ
      </Button>
    </main>
  );
}

function ReviewRunner({
  initialCards,
  onRestart,
}: {
  initialCards: UserWord[];
  onRestart: () => void;
}) {
  // Local session: Again appends the card to the end (SPEC §6.3) — no refetch.
  const [session, setSession] = useState<UserWord[]>(initialCards);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const submit = useSubmitAnswer();
  const queryClient = useQueryClient();

  // When the session ends, mark the day's queue stale (so Home shows fresh
  // counts on its next mount) and refresh the streak in the header.
  const done = step >= session.length;
  useEffect(() => {
    if (!done) return;
    queryClient.invalidateQueries({ queryKey: ["review-queue"], refetchType: "none" });
    queryClient.invalidateQueries({ queryKey: ["stats-overview"] });
  }, [done, queryClient]);

  if (done) {
    return (
      <Centered>
        <span className="bg-primary/15 border-primary/40 animate-pop-in grid h-22 w-22 place-items-center rounded-full border-[1.5px] backdrop-blur-md">
          <TrophyIcon />
        </span>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">Xong phiên ôn!</h1>
        <p className="text-muted-fg text-base">
          Đã ôn {completed} thẻ{againCount > 0 && `, ${againCount} lượt Again`}.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button onClick={onRestart}>Ôn thêm lượt nữa</Button>
          <Link
            href="/"
            className="border-chip-border bg-surface-2 text-muted-fg hover:bg-surface hover:text-fg inline-flex h-11 items-center rounded-full border-[1.5px] px-5 text-sm font-semibold backdrop-blur-md transition-colors"
          >
            ← Về trang chủ
          </Link>
        </div>
      </Centered>
    );
  }

  const card = session[step];

  async function handleGrade(rating: Rating) {
    try {
      await submit.mutateAsync({ userWordId: card.id, rating });
    } catch {
      return; // stay on the card so the user can retry; error shown below
    }
    if (rating === "again") {
      setSession((current) => [...current, card]);
      setAgainCount((n) => n + 1);
    } else {
      setCompleted((n) => n + 1);
    }
    setStep((s) => s + 1);
  }

  const remaining = session.length - step;
  const progress = Math.round((step / session.length) * 100);

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4.5 px-4 py-9 sm:px-8">
      <header className="animate-card-in flex items-center gap-3.5">
        <Badge variant={isNewCard(card) ? "info" : "streak"} className="tracking-wide uppercase">
          {isNewCard(card) ? "Thẻ mới" : "Ôn lại"}
        </Badge>
        <div
          className="border-chip-border bg-surface-2 h-2.5 flex-1 overflow-hidden rounded-full border"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="from-primary-hover to-primary h-full rounded-full bg-gradient-to-r transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-muted-fg shrink-0 text-[13px] font-semibold">
          Còn {remaining} thẻ
        </span>
      </header>
      <ReviewCard
        key={step}
        card={card}
        submitting={submit.isPending}
        errorMessage={submit.isError ? "Không lưu được kết quả. Thử lại." : null}
        onGrade={handleGrade}
      />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="text-fg animate-card-in mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      {children}
    </main>
  );
}

function HomeLink() {
  return (
    <Link href="/" className="text-primary-text mt-2 text-sm font-bold hover:underline">
      ← Về trang chủ
    </Link>
  );
}

function TrophyIcon() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary-text)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z" />
      <path d="M6 6H3.5a2.8 2.8 0 0 0 3 4.6M18 6h2.5a2.8 2.8 0 0 1-3 4.6" />
    </svg>
  );
}
