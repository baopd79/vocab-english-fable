import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Elevated glass surface — the base container of the v2 glassmorphism style. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-3xl p-6", className)} {...props} />;
}
