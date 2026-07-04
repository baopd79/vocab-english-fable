"use client";

import Link from "next/link";
import { useState } from "react";

import { ReviewCard } from "@/components/review-card";
import { RequireAuth } from "@/components/require-auth";
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
        <p>Hôm nay bạn không có thẻ nào cần ôn. 🎉</p>
        <HomeLink />
      </Centered>
    );
  }
  // Keyed by nothing special — mounted once; the session lives in local state.
  return <ReviewRunner initialCards={cards} />;
}

function ReviewRunner({ initialCards }: { initialCards: UserWord[] }) {
  // Local session: Again appends the card to the end (SPEC §6.3) — no refetch.
  const [session, setSession] = useState<UserWord[]>(initialCards);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const submit = useSubmitAnswer();

  if (step >= session.length) {
    return (
      <Centered>
        <p className="text-lg font-medium">Xong phiên ôn! 🎉</p>
        <p className="text-sm text-gray-600">
          Đã ôn {completed} thẻ{againCount > 0 && `, ${againCount} lượt Again`}.
        </p>
        <HomeLink />
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
      <header className="flex items-center justify-between text-sm text-gray-600">
        <span>{isNewCard(card) ? "Thẻ mới" : "Ôn lại"}</span>
        <span>Còn lại: {remaining}</span>
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-gray-700">
      {children}
    </main>
  );
}

function HomeLink() {
  return (
    <Link href="/" className="text-sm text-blue-600 hover:underline">
      ← Về trang chủ
    </Link>
  );
}
