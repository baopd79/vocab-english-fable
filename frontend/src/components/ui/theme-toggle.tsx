"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/**
 * Theme lives on `<html data-theme>` (set before paint by the inline script in
 * layout.tsx). We treat that attribute as an external store: read it, flip it on
 * click, persist the choice, and re-render every toggle in sync. With no stored
 * preference the theme keeps following the system.
 */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const hasMatchMedia = typeof window.matchMedia === "function";
  const mq = hasMatchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const onSystemChange = () => {
    if (readStored()) return; // an explicit choice wins over system changes
    document.documentElement.dataset.theme = mq!.matches ? "dark" : "light";
    notify();
  };
  mq?.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(onChange);
    mq?.removeEventListener("change", onSystemChange);
  };
}

function readStored(): string | null {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

function getSnapshot(): Theme {
  return (document.documentElement.dataset.theme as Theme) || "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // ignore
  }
  notify();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Đổi giao diện sáng/tối"
      className="border-chip-border bg-surface-2 text-muted-fg hover:text-primary-text hover:bg-surface focus-visible:ring-ring focus-visible:ring-offset-bg inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
