import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type Grade = "again" | "hard" | "good" | "easy";

const GRADE_STYLE: Record<Grade, string> = {
  again:
    "bg-grade-again shadow-[0_4px_0_var(--grade-again-shadow)] active:shadow-[0_1px_0_var(--grade-again-shadow)]",
  hard: "bg-grade-hard shadow-[0_4px_0_var(--grade-hard-shadow)] active:shadow-[0_1px_0_var(--grade-hard-shadow)]",
  good: "bg-grade-good shadow-[0_4px_0_var(--grade-good-shadow)] active:shadow-[0_1px_0_var(--grade-good-shadow)]",
  easy: "bg-grade-easy shadow-[0_4px_0_var(--grade-easy-shadow)] active:shadow-[0_1px_0_var(--grade-easy-shadow)]",
};

/** One SM-2 self-grade button: solid 3D block in its functional color. */
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
        "flex h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl text-white",
        "font-extrabold transition-[transform,filter,box-shadow] duration-150",
        "hover:-translate-y-px hover:brightness-105 active:translate-y-[3px]",
        "focus-visible:ring-offset-bg focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        GRADE_STYLE[grade],
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      <span className="text-[11px] font-semibold opacity-85">phím {hotkey}</span>
    </button>
  );
}
