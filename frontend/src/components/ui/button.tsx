import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

/* 3D pills (Duolingo-style): a hard bottom "edge" shadow that collapses when
 * pressed, so the button visually travels down onto it. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-[0_4px_0_var(--primary-shadow)] hover:bg-primary-hover active:translate-y-[3px] active:shadow-[0_1px_0_var(--primary-shadow)]",
  secondary:
    "bg-white text-primary-text shadow-[0_4px_0_rgba(0,0,0,0.18)] hover:-translate-y-px active:translate-y-[2px] active:shadow-[0_1px_0_rgba(0,0,0,0.18)]",
  danger:
    "bg-danger text-white shadow-[0_3px_0_var(--danger-shadow)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_var(--danger-shadow)]",
  outline:
    "border-[1.5px] border-chip-border bg-surface-2 text-muted-fg backdrop-blur-md hover:bg-surface hover:text-fg",
  ghost: "text-muted-fg hover:text-fg",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-bold",
        "transition-[background-color,filter,transform,box-shadow] duration-150",
        "focus-visible:ring-ring focus-visible:ring-offset-bg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
