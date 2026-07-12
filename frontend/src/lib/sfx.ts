/**
 * Feedback chimes synthesized with WebAudio (SPEC §17.1-B4, §17.3-Q5) — no
 * audio assets, no licensing. Muted state persists per device in localStorage
 * (same convention as the theme choice). Everything no-ops where AudioContext
 * is unavailable (SSR, jsdom).
 */

const MUTE_KEY = "sfx-muted";

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return true;
  }
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode without storage — the in-memory toggle still works.
  }
}

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  // Browsers park fresh contexts as "suspended" until a user gesture; every
  // play call here happens inside a click handler, so resume is allowed.
  if (context.state === "suspended") void context.resume();
  return context;
}

type Note = {
  freq: number;
  at: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

function play(notes: Note[]): void {
  if (isMuted()) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;
    const start = now + note.at;
    const end = start + note.duration;
    // Quick attack, exponential decay — chime-like, no clicks at the edges.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.gain ?? 0.12, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  }
}

/** Good/Easy: short ascending ding. */
export function playCorrect(): void {
  play([
    { freq: 660, at: 0, duration: 0.12 },
    { freq: 880, at: 0.09, duration: 0.18 },
  ]);
}

/** Again/Hard: soft low descending buzz — noticeable, never harsh. */
export function playWrong(): void {
  play([
    { freq: 220, at: 0, duration: 0.2, type: "triangle", gain: 0.1 },
    { freq: 185, at: 0.12, duration: 0.22, type: "triangle", gain: 0.1 },
  ]);
}

/** Session finished: C-major arpeggio fanfare. */
export function playFanfare(): void {
  play([
    { freq: 523.25, at: 0, duration: 0.15 },
    { freq: 659.25, at: 0.12, duration: 0.15 },
    { freq: 783.99, at: 0.24, duration: 0.15 },
    { freq: 1046.5, at: 0.36, duration: 0.4 },
  ]);
}
