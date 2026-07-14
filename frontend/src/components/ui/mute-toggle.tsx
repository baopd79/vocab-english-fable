"use client";

import { useState } from "react";

import { isMuted, setMuted } from "@/lib/sfx";

/** Speaker on/off for the feedback chimes — persisted per device (§17.3-Q5).
 * Used by both the SM-2 review runner and the cram runner. */
export function MuteToggle() {
  const [muted, setMutedState] = useState(isMuted);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      type="button"
      aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
      aria-pressed={!muted}
      onClick={toggle}
      className="border-chip-border bg-surface-2 text-muted-fg hover:text-fg hover:bg-surface focus-visible:ring-ring inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {muted ? <MutedIcon /> : <SoundIcon />}
    </button>
  );
}

function SoundIcon() {
  return (
    <svg
      width="15"
      height="15"
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
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" stroke="none" />
      <path d="m16 9 6 6M22 9l-6 6" />
    </svg>
  );
}
