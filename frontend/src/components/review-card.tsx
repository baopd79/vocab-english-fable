"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradeButton } from "@/components/ui/grade-button";
import { Card } from "@/components/ui/card";
import { isTypingCorrect } from "@/lib/normalize";
import { isNewCard, type Rating } from "@/lib/review";
import { speak } from "@/lib/tts";
import type { UserWord } from "@/lib/words";

const GRADES: { rating: Rating; label: string; key: string }[] = [
  { rating: "again", label: "Again", key: "1" },
  { rating: "hard", label: "Hard", key: "2" },
  { rating: "good", label: "Good", key: "3" },
  { rating: "easy", label: "Easy", key: "4" },
];

type Phase = "typing" | "flipped";

/**
 * One review: recall by typing (old cards) → flip to the full card → self-grade.
 * New cards skip typing and start flipped (SPEC §6.7). The two faces render
 * exclusively (never both in the DOM) so the answer cannot leak; the flip is
 * suggested by a rotateY entrance animation on the answer face.
 */
export function ReviewCard({
  card,
  onGrade,
  submitting = false,
  errorMessage,
}: {
  card: UserWord;
  onGrade: (rating: Rating) => void;
  submitting?: boolean;
  errorMessage?: string | null;
}) {
  const isNew = isNewCard(card);
  const [phase, setPhase] = useState<Phase>(isNew ? "flipped" : "typing");
  const [typed, setTyped] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);

  // Keyboard shortcuts 1–4 grade the card once it is flipped (Anki-style).
  useEffect(() => {
    if (phase !== "flipped" || submitting) return;
    function onKey(event: KeyboardEvent) {
      const grade = GRADES.find((g) => g.key === event.key);
      if (grade) onGrade(grade.rating);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, submitting, onGrade]);

  function reveal() {
    setCorrect(isTypingCorrect(typed, card.word_text));
    setPhase("flipped");
  }

  if (phase === "typing") {
    return (
      <Card className="animate-card-in flex min-h-80 flex-col justify-center gap-5 p-7 sm:p-9">
        <p className="text-subtle-fg text-[13px] font-bold tracking-[.12em] uppercase">
          Nhớ lại và gõ từ tiếng Anh
        </p>
        <p className="font-display text-[26px] leading-snug font-bold tracking-tight">
          {card.meaning_vi || <span className="text-muted-fg">(chưa có nghĩa)</span>}
          {card.part_of_speech && (
            <span className="text-subtle-fg font-sans ml-2 align-middle text-[15px] font-normal italic">
              {card.part_of_speech}
            </span>
          )}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            reveal();
          }}
          className="flex gap-2.5"
        >
          <input
            aria-label="Đáp án"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Gõ từ…"
            className="border-border bg-surface text-fg placeholder:text-subtle-fg focus-visible:border-primary focus-visible:ring-primary/20 h-13 flex-1 rounded-[14px] border-[1.5px] px-4 text-[17px] focus-visible:ring-[3px] focus-visible:outline-none"
          />
          <Button type="submit" size="lg" className="rounded-[14px] text-[15px]">
            Lật thẻ
          </Button>
        </form>
        <p className="text-subtle-fg text-[13px]">
          Không nhớ? Cứ lật thẻ — chọn <strong>Again</strong> để gặp lại từ này ngay trong phiên.
        </p>
      </Card>
    );
  }

  return (
    <Card
      className={`${isNew ? "animate-card-in" : "animate-flip-in"} flex min-h-80 flex-col gap-4.5 p-7 sm:p-9`}
    >
      {correct === true && (
        <p className="text-primary-text bg-primary/15 border-primary/35 animate-pop-in flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold">
          <CheckIcon /> Chính xác!
        </p>
      )}
      {correct === false && (
        <p className="text-danger-text bg-danger/12 border-danger/35 rounded-xl border px-3.5 py-2.5 text-sm font-semibold">
          Bạn gõ “{typed || "(trống)"}” — chưa đúng. Gợi ý: chọn <strong>Again</strong>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3.5">
        <span className="font-display text-[42px] leading-none font-extrabold tracking-tight">
          {card.word_text}
        </span>
        {card.ipa && <span className="text-subtle-fg text-[17px]">{card.ipa}</span>}
        <button
          type="button"
          aria-label="Phát âm"
          onClick={() => speak(card.word_text)}
          className="border-chip-border bg-surface-2 text-primary-text hover:bg-primary/15 hover:border-primary/40 focus-visible:ring-ring inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none active:translate-y-px"
        >
          <SpeakerIcon />
        </button>
        {card.part_of_speech && <Badge variant="primary">{card.part_of_speech}</Badge>}
      </div>

      <div className="border-border flex flex-col gap-2 border-t-[1.5px] border-dashed pt-4">
        <p className="text-lg font-semibold">{card.meaning_vi}</p>
        {card.example_en && (
          <>
            <p className="text-muted-fg text-[15px] italic">“{card.example_en}”</p>
            {card.example_vi && <p className="text-subtle-fg text-sm">{card.example_vi}</p>}
          </>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {errorMessage}
        </p>
      )}

      <div className="mt-auto grid grid-cols-4 gap-2.5">
        {GRADES.map((grade) => (
          <GradeButton
            key={grade.rating}
            grade={grade.rating}
            label={grade.label}
            hotkey={grade.key}
            disabled={submitting}
            onClick={() => onGrade(grade.rating)}
          />
        ))}
      </div>
    </Card>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
      <path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
