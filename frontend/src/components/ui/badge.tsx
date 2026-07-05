import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "primary" | "info" | "streak";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 border-chip-border text-muted-fg",
  primary: "bg-primary/15 border-primary/35 text-primary-text",
  info: "bg-info/15 border-info/40 text-info-text",
  streak: "bg-streak/15 border-streak/40 text-streak-text",
};

/** Small bordered pill for status/labels (new vs review, part of speech, streak). */
export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
