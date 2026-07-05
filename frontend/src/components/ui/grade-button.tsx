import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type Grade = "again" | "hard" | "good" | "easy";

const GRADE_BG: Record<Grade, string> = {
  again: "bg-grade-again",
  hard: "bg-grade-hard",
  good: "bg-grade-good",
  easy: "bg-grade-easy",
};

/** One SM-2 self-grade button: solid functional color, label + keycap.
 * White text on the -600/-700 backgrounds clears WCAG AA in both themes. */
export function GradeButton({
  grade,
  label,
  hotkey,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  grade: Grade;
  label: string;
  hotkey: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-white",
        "font-display font-semibold transition-transform duration-150 active:scale-[0.96]",
        "focus-visible:ring-offset-bg focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        GRADE_BG[grade],
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      <kbd className="rounded bg-white/25 px-1.5 text-xs font-normal not-italic">{hotkey}</kbd>
    </button>
  );
}
