import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Elevated surface block — the base container of the block-based style. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-border bg-surface rounded-2xl border p-6 shadow-sm", className)}
      {...props}
    />
  );
}
