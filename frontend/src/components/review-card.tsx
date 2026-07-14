"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradeButton, type Grade } from "@/components/ui/grade-button";
import { Card } from "@/components/ui/card";
import { SpeakerButton } from "@/components/ui/speaker-button";
import { isTypingCorrect } from "@/lib/normalize";
import { isNewCard, type Rating } from "@/lib/review";
import { speak } from "@/lib/tts";
import type { ReviewMode, UserWord } from "@/lib/words";

/** Cram-mode self-grade (SPEC §17.2-11): local only, never sent to the API. */
export type CramRating = "forgot" | "got";

type GradeAction = { value: string; label: string; key: string; grade: Grade };

const REVIEW_GRADES: GradeAction[] = [
  { value: "again", label: "Again", key: "1", grade: "again" },
  { value: "hard", label: "Hard", key: "2", grade: "hard" },
  { value: "good", label: "Good", key: "3", grade: "good" },
  { value: "easy", label: "Easy", key: "4", grade: "easy" },
];

const CRAM_GRADES: GradeAction[] = [
  { value: "forgot", label: "Chưa nhớ", key: "1", grade: "again" },
  { value: "got", label: "Đã nhớ", key: "2", grade: "good" },
];

const FRONT_LABELS: Record<ReviewMode, string> = {
  classic: "Nhớ lại và gõ từ tiếng Anh",
  mcq: "Chọn nghĩa tiếng Việt đúng",
  listening: "Nghe và gõ lại từ",
};

type Phase = "front" | "flipped";

type ReviewCardProps = {
  card: UserWord;
  submitting?: boolean;
  errorMessage?: string | null;
} & (
  | { mode?: "review"; onGrade: (rating: Rating) => void }
  | { mode: "cram"; onGrade: (rating: CramRating) => void }
);

/**
 * One review: an asking front → flip to the full card → self-grade. The front
 * follows the card's `review_mode` (SPEC §17.2-10): classic recalls by typing
 * from the VI meaning, MCQ shows the word and 4 meanings to pick from,
 * listening plays the word (auto + replay button) and asks to type it. New
 * cards skip the front and start flipped (SPEC §6.7). The two faces render
 * exclusively (never both in the DOM) so the answer cannot leak; the flip is
 * suggested by a rotateY entrance animation on the answer face.
 *
 * mode="cram" (SPEC §17.2-11): every card gets the classic typing front and
 * the SM-2 row becomes two local buttons (Chưa nhớ / Đã nhớ) — nothing
 * touches the API.
 */
export function ReviewCard(props: ReviewCardProps) {
  const { card, submitting = false, errorMessage } = props;
  const cram = props.mode === "cram";
  // Cram always drills typing; an MCQ card without choices (defensive — the
  // backend already falls back) is asked classic so the front is never empty.
  const requested: ReviewMode = cram ? "classic" : (card.review_mode ?? "classic");
  const variant: ReviewMode =
    requested === "mcq" && !card.mcq_choices?.length ? "classic" : requested;
  // Review lets brand-new cards skip the front; cram drills every card the same way.
  const startFlipped = !cram && isNewCard(card);
  const [phase, setPhase] = useState<Phase>(startFlipped ? "flipped" : "front");
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  const grades = cram ? CRAM_GRADES : REVIEW_GRADES;
  const retryLabel = cram ? "Chưa nhớ" : "Again";
  // Both union branches accept their own subset of `value`; the actions table
  // above is the single source of truth, so the widening cast is safe.
  const fire = props.onGrade as (value: string) => void;

  const pick = useCallback(
    (choice: string) => {
      setPicked(choice);
      setCorrect(choice === card.meaning_vi);
      setPhase("flipped");
    },
    [card.meaning_vi],
  );

  // Listening cards announce themselves shortly after mount (§17.3-Q1:
  // auto-play); the speaker button replays. The delay + cleanup matter: two
  // speaks in quick succession (React StrictMode double-mounts in dev) make
  // the second cancel() interrupt an utterance still spinning up, which jams
  // Chrome's speech engine until the page reloads.
  useEffect(() => {
    if (variant !== "listening") return;
    const id = window.setTimeout(() => speak(card.word_text), 200);
    return () => window.clearTimeout(id);
  }, [variant, card.word_text]);

  // Keys 1–4 pick an MCQ answer while the question is up.
  useEffect(() => {
    if (phase !== "front" || variant !== "mcq" || submitting) return;
    const choices = card.mcq_choices ?? [];
    function onKey(event: KeyboardEvent) {
      const index = Number.parseInt(event.key, 10) - 1;
      if (Number.isNaN(index) || index < 0 || index >= choices.length) return;
      event.preventDefault();
      pick(choices[index]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, variant, submitting, card.mcq_choices, pick]);

  // Keyboard shortcuts grade the card once it is flipped (Anki-style).
  useEffect(() => {
    if (phase !== "flipped" || submitting) return;
    function onKey(event: KeyboardEvent) {
      const grade = grades.find((g) => g.key === event.key);
      if (!grade) return;
      // Consume the key: without this the digit's default action lands in the
      // next card's autofocused typing input (grading remounts it mid-event).
      event.preventDefault();
      fire(grade.value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, submitting, grades, fire]);

  function reveal() {
    setCorrect(isTypingCorrect(typed, card.word_text));
    setPhase("flipped");
  }

  if (phase === "front") {
    return (
      <Card className="animate-card-in flex min-h-80 flex-col justify-center gap-5 p-7 sm:p-9">
        <p className="text-subtle-fg text-[13px] font-bold tracking-[.12em] uppercase">
          {FRONT_LABELS[variant]}
        </p>

        {variant === "classic" && (
          <p className="font-display text-[26px] leading-snug font-bold tracking-tight">
            {card.meaning_vi || <span className="text-muted-fg">(chưa có nghĩa)</span>}
            {card.part_of_speech && (
              <span className="text-subtle-fg font-sans ml-2 align-middle text-[15px] font-normal italic">
                {card.part_of_speech}
              </span>
            )}
          </p>
        )}

        {variant === "mcq" && (
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="font-display text-[34px] leading-none font-extrabold tracking-tight">
              {card.word_text}
            </span>
            {card.ipa && <span className="text-subtle-fg text-[15px]">{card.ipa}</span>}
            <SpeakerButton text={card.word_text} label="Phát âm" />
          </div>
        )}

        {variant === "listening" && (
          <div className="flex items-center gap-4">
            <SpeakerButton text={card.word_text} label="Nghe lại" size="lg" />
            <p className="text-muted-fg text-[15px] font-medium">Bấm nút loa để nghe lại từ.</p>
          </div>
        )}

        {variant === "mcq" ? (
          <>
            <div className="flex flex-col gap-2.5">
              {(card.mcq_choices ?? []).map((choice, index) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => pick(choice)}
                  className="border-border bg-surface hover:border-primary/50 hover:bg-primary/10 focus-visible:ring-ring flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3 text-left text-[15px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none active:translate-y-px"
                >
                  <span className="border-chip-border bg-surface-2 text-subtle-fg grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[12px] font-bold">
                    {index + 1}
                  </span>
                  {choice}
                </button>
              ))}
            </div>
            <p className="text-subtle-fg text-[13px]">
              Chọn nhanh bằng phím 1–4. Lỡ sai? Chọn <strong>{retryLabel}</strong> để gặp lại từ này
              ngay trong phiên.
            </p>
          </>
        ) : (
          <>
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
                placeholder={variant === "listening" ? "Gõ từ bạn nghe được…" : "Gõ từ…"}
                className="border-border bg-surface text-fg placeholder:text-subtle-fg focus-visible:border-primary focus-visible:ring-primary/20 h-13 flex-1 rounded-[14px] border-[1.5px] px-4 text-[17px] focus-visible:ring-[3px] focus-visible:outline-none"
              />
              <Button type="submit" size="lg" className="rounded-[14px] text-[15px]">
                Lật thẻ
              </Button>
            </form>
            <p className="text-subtle-fg text-[13px]">
              Không nhớ? Cứ lật thẻ — chọn <strong>{retryLabel}</strong> để gặp lại từ này ngay
              trong phiên.
            </p>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card
      className={`${startFlipped ? "animate-card-in" : "animate-flip-in"} flex min-h-80 flex-col gap-4.5 p-7 sm:p-9`}
    >
      {correct === true && (
        <p className="text-primary-text bg-primary/15 border-primary/35 animate-pop-in flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold">
          <CheckIcon /> Chính xác!
        </p>
      )}
      {correct === false && (
        <p className="text-danger-text bg-danger/12 border-danger/35 rounded-xl border px-3.5 py-2.5 text-sm font-semibold">
          {variant === "mcq" ? <>Bạn chọn “{picked}”</> : <>Bạn gõ “{typed || "(trống)"}”</>} — chưa
          đúng. Gợi ý: chọn <strong>{retryLabel}</strong>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3.5">
        <span className="font-display text-[42px] leading-none font-extrabold tracking-tight">
          {card.word_text}
        </span>
        {card.ipa && <span className="text-subtle-fg text-[17px]">{card.ipa}</span>}
        <SpeakerButton text={card.word_text} label="Phát âm" />
        {card.part_of_speech && <Badge variant="primary">{card.part_of_speech}</Badge>}
      </div>

      <div className="border-border flex flex-col gap-2 border-t-[1.5px] border-dashed pt-4">
        <p className="text-lg font-semibold">{card.meaning_vi}</p>
        {card.example_en && (
          <>
            <div className="flex items-start gap-2">
              <SpeakerButton
                text={card.example_en}
                size="sm"
                label="Phát âm câu ví dụ"
                className="mt-0.5"
              />
              <p className="text-muted-fg min-w-0 text-[15px] italic">“{card.example_en}”</p>
            </div>
            {card.example_vi && <p className="text-subtle-fg text-sm">{card.example_vi}</p>}
          </>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {errorMessage}
        </p>
      )}

      <div className={`mt-auto grid gap-2.5 ${cram ? "grid-cols-2" : "grid-cols-4"}`}>
        {grades.map((grade) => (
          <GradeButton
            key={grade.value}
            grade={grade.grade}
            label={grade.label}
            hotkey={grade.key}
            disabled={submitting}
            onClick={() => fire(grade.value)}
          />
        ))}
      </div>
    </Card>
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
