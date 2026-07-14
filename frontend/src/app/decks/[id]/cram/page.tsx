"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Confetti } from "@/components/confetti";
import { ReviewCard, type CramRating } from "@/components/review-card";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MuteToggle } from "@/components/ui/mute-toggle";
import { useCramSession } from "@/lib/cram";
import { playCorrect, playFanfare, playWrong } from "@/lib/sfx";
import { stopSpeaking } from "@/lib/tts";
import type { UserWord } from "@/lib/words";

/** Cram mode (SPEC §17.2-11): flip through a whole deck freely. Everything is
 * local — no answer API, no ReviewLog, the SM-2 schedule stays untouched. */
export default function CramPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <CramContent deckId={Number(params.id)} />
    </RequireAuth>
  );
}

export function CramContent({ deckId }: { deckId: number }) {
  const session = useCramSession(deckId);
  // Bumped by "Ôn lại lượt nữa": remounts the runner over a reshuffled deck.
  const [round, setRound] = useState(0);

  if (session.isPending) {
    return <Centered>Đang tải…</Centered>;
  }
  if (session.isError) {
    return <Centered>Không tải được deck.</Centered>;
  }
  if (session.data.length === 0) {
    return (
      <Centered>
        <p className="text-lg font-semibold">Deck này chưa có từ nào tra cứu xong để ôn.</p>
        <BackToDeckLink deckId={deckId} />
      </Centered>
    );
  }
  return (
    <CramRunner
      key={round}
      deckId={deckId}
      initialCards={session.data}
      onRestart={async () => {
        await session.refetch(); // queryFn reshuffles
        setRound((r) => r + 1);
      }}
    />
  );
}

function CramRunner({
  deckId,
  initialCards,
  onRestart,
}: {
  deckId: number;
  initialCards: UserWord[];
  onRestart: () => void;
}) {
  // Local session: "Chưa nhớ" appends the card to the end — nothing is sent.
  const [session, setSession] = useState<UserWord[]>(initialCards);
  const [step, setStep] = useState(0);
  const [gotCount, setGotCount] = useState(0);
  const [forgotCount, setForgotCount] = useState(0);

  const done = step >= session.length;
  useEffect(() => {
    if (done) playFanfare();
  }, [done]);

  if (done) {
    return (
      <Centered>
        <Confetti />
        <span className="bg-primary/15 border-primary/40 animate-pop-in grid h-22 w-22 place-items-center rounded-full border-[1.5px] backdrop-blur-md">
          <LightningIcon />
        </span>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">
          Xong phiên ôn tự do!
        </h1>
        <p className="text-muted-fg text-base">
          Đã thuộc {gotCount} thẻ{forgotCount > 0 && `, ${forgotCount} lượt chưa nhớ`}.
        </p>
        <p className="text-subtle-fg text-sm">Phiên tự do không ảnh hưởng lịch ôn SM-2.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button onClick={onRestart}>Ôn lại lượt nữa</Button>
          <Link
            href={`/decks/${deckId}`}
            className="border-chip-border bg-surface-2 text-muted-fg hover:bg-surface hover:text-fg inline-flex h-11 items-center rounded-full border-[1.5px] px-5 text-sm font-semibold backdrop-blur-md transition-colors"
          >
            ← Về deck
          </Link>
        </div>
      </Centered>
    );
  }

  const card = session[step];

  function handleGrade(rating: CramRating) {
    // Same feedback rhythm as the SM-2 runner (chime never overlaps TTS)…
    stopSpeaking();
    if (rating === "got") {
      playCorrect();
      setGotCount((n) => n + 1);
    } else {
      playWrong();
      setSession((current) => [...current, card]);
      setForgotCount((n) => n + 1);
    }
    // …but the grade stays local: no mutation, no ReviewLog (SPEC §17.2-11).
    setStep((s) => s + 1);
  }

  const remaining = session.length - step;
  const progress = Math.round((step / session.length) * 100);

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4.5 px-4 py-9 sm:px-8">
      <header className="animate-card-in flex items-center gap-3.5">
        <Badge variant="info" className="tracking-wide uppercase">
          Ôn tự do
        </Badge>
        <div
          className="border-chip-border bg-surface-2 h-2.5 flex-1 overflow-hidden rounded-full border"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="from-info to-info h-full rounded-full bg-gradient-to-r transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-muted-fg shrink-0 text-[13px] font-semibold">
          Còn {remaining} thẻ
        </span>
        <MuteToggle />
      </header>
      <ReviewCard key={step} card={card} mode="cram" onGrade={handleGrade} />
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

function BackToDeckLink({ deckId }: { deckId: number }) {
  return (
    <Link
      href={`/decks/${deckId}`}
      className="text-primary-text mt-2 text-sm font-bold hover:underline"
    >
      ← Về deck
    </Link>
  );
}

function LightningIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="var(--primary-text)" aria-hidden="true">
      <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
    </svg>
  );
}
