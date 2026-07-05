"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ReviewCard } from "@/components/review-card";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isNewCard, useReviewQueue, useSubmitAnswer, type Rating } from "@/lib/review";
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
