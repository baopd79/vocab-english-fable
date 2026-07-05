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
 * New cards skip typing and start flipped (SPEC §6.7).
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
      <Card className="flex flex-col gap-5">
        <p className="text-muted-fg text-sm font-medium">Nhớ lại và gõ từ tiếng Anh:</p>
        <p className="text-2xl leading-snug font-semibold">
          {card.meaning_vi || <span className="text-muted-fg">(chưa có nghĩa)</span>}
          {card.part_of_speech && (
            <Badge variant="primary" className="ml-2 align-middle">
              {card.part_of_speech}
            </Badge>
          )}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            reveal();
          }}
          className="flex gap-2"
        >
          <input
            aria-label="Đáp án"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Gõ từ…"
            className="border-border bg-surface-2 text-fg placeholder:text-muted-fg focus-visible:ring-ring focus-visible:border-primary h-11 flex-1 rounded-xl border px-4 focus-visible:ring-2 focus-visible:outline-none"
          />
          <Button type="submit">Lật thẻ</Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      {correct === true && (
        <p className="text-accent flex items-center gap-1.5 text-sm font-semibold">
          <CheckIcon /> Chính xác!
        </p>
      )}
      {correct === false && (
        <p className="text-grade-again text-sm font-medium">
          Bạn gõ “{typed || "(trống)"}” — chưa đúng. Gợi ý: chọn <strong>Again</strong>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-4xl font-bold tracking-tight">{card.word_text}</span>
        {card.ipa && <span className="text-muted-fg text-lg">{card.ipa}</span>}
        <button
          type="button"
          aria-label="Phát âm"
          onClick={() => speak(card.word_text)}
          className="border-border text-muted-fg hover:bg-surface-2 hover:text-primary focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <SpeakerIcon />
        </button>
        {card.part_of_speech && <Badge variant="primary">{card.part_of_speech}</Badge>}
      </div>

      <div className="text-fg">
        <p className="text-lg">{card.meaning_vi}</p>
        {card.example_en && (
          <div className="border-primary/30 mt-3 border-l-2 pl-3">
            <p className="text-fg">{card.example_en}</p>
            {card.example_vi && <p className="text-muted-fg">{card.example_vi}</p>}
          </div>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="text-grade-again text-sm font-medium">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
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
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
