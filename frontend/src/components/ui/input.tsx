import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Shared control styling — token-driven, 44px-tall for touch. */
export const fieldBase =
  "border-border bg-surface-2 text-fg placeholder:text-muted-fg focus-visible:ring-ring focus-visible:border-primary w-full rounded-xl border transition-colors focus-visible:ring-2 focus-visible:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-11 px-4", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-20 px-4 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "h-11 px-3", className)} {...props} />;
}

/** Label + control + optional hint, stacked. The control keeps its own
 * aria-label (tests query by it), so the visible label is purely presentational. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-muted-fg text-xs">{hint}</span>}
    </label>
  );
}
