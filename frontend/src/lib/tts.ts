/**
 * Pronounce text via the browser Web Speech API (SPEC §6.7) — free, no backend.
 * A no-op where speechSynthesis is unavailable (SSR, jsdom, older browsers).
 */
export function speak(text: string, lang = "en-US"): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.cancel(); // drop anything mid-speech before the new word
  window.speechSynthesis.speak(utterance);
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Cut off any in-flight speech, e.g. before a feedback chime (SPEC §17.2-8). */
export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
