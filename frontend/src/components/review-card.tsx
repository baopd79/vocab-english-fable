"use client";

import { useEffect, useState } from "react";

import { isTypingCorrect } from "@/lib/normalize";
import { isNewCard, type Rating } from "@/lib/review";
import { speak } from "@/lib/tts";
import type { UserWord } from "@/lib/words";

const GRADES: { rating: Rating; label: string; key: string; className: string }[] = [
  { rating: "again", label: "Again", key: "1", className: "bg-red-600" },
  { rating: "hard", label: "Hard", key: "2", className: "bg-orange-500" },
  { rating: "good", label: "Good", key: "3", className: "bg-green-600" },
  { rating: "easy", label: "Easy", key: "4", className: "bg-blue-600" },
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
      <section className="flex flex-col gap-4 rounded border border-gray-200 p-6">
        <p className="text-sm text-gray-500">Nhớ lại và gõ từ tiếng Anh:</p>
        <p className="text-lg">
          {card.meaning_vi || <span className="text-gray-400">(chưa có nghĩa)</span>}
          {card.part_of_speech && (
            <span className="ml-2 text-sm italic text-gray-500">{card.part_of_speech}</span>
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
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
            Lật thẻ
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded border border-gray-200 p-6">
      {correct === true && <p className="text-sm text-green-600">Chính xác!</p>}
      {correct === false && (
        <p className="text-sm text-red-600">
          Bạn gõ “{typed || "(trống)"}” — chưa đúng. Gợi ý: chọn <strong>Again</strong>.
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold">{card.word_text}</span>
        {card.ipa && <span className="text-gray-500">{card.ipa}</span>}
        <button
          type="button"
          aria-label="Phát âm"
          onClick={() => speak(card.word_text)}
          className="rounded border border-gray-300 px-2 py-1 text-lg hover:bg-gray-50"
        >
          🔊
        </button>
        {card.part_of_speech && (
          <span className="text-sm italic text-gray-500">{card.part_of_speech}</span>
        )}
      </div>

      <div className="text-gray-700">
        <p>{card.meaning_vi}</p>
        {card.example_en && (
          <p className="mt-2 text-gray-600">
            {card.example_en}
            {card.example_vi && <span className="block text-gray-500">{card.example_vi}</span>}
          </p>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {GRADES.map((grade) => (
          <button
            key={grade.rating}
            type="button"
            disabled={submitting}
            onClick={() => onGrade(grade.rating)}
            className={`rounded px-3 py-2 text-sm text-white disabled:opacity-50 ${grade.className}`}
          >
            {grade.label}
            <span className="ml-1 opacity-70">{grade.key}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
