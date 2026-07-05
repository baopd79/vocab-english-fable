import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Shared control styling — token-driven, translucent over the glass. */
export const fieldBase =
  "border-border bg-surface text-fg placeholder:text-subtle-fg focus-visible:border-primary focus-visible:ring-primary/20 w-full rounded-xl border-[1.5px] transition-colors focus-visible:ring-[3px] focus-visible:outline-none";

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
      <span className="text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="text-subtle-fg text-xs">{hint}</span>}
    </label>
  );
}
