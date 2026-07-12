"use client";

import { cn } from "@/lib/cn";
import { speak } from "@/lib/tts";

const SIZES = {
  md: { button: "h-10 w-10", icon: 18 },
  sm: { button: "h-7 w-7", icon: 14 },
} as const;

/** Round speaker button pronouncing `text` via TTS (SPEC §17.1-B2/F7). Safe
 * inside clickable cards and forms: the click never bubbles to a parent link
 * and never submits (type="button" + preventDefault + stopPropagation). */
export function SpeakerButton({
  text,
  size = "md",
  label = "Phát âm",
  disabled = false,
  className,
}: {
  text: string;
  size?: keyof typeof SIZES;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        speak(text);
      }}
      className={cn(
        "border-chip-border bg-surface-2 text-primary-text hover:bg-primary/15 hover:border-primary/40 focus-visible:ring-ring inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
        s.button,
        className,
      )}
    >
      <SpeakerIcon size={s.icon} />
    </button>
  );
}

function SpeakerIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
