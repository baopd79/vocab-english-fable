import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "primary" | "accent" | "streak";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-muted-fg",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  streak: "bg-streak/15 text-streak",
};

/** Small pill for status/labels (new vs review, part of speech, streak). */
export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
