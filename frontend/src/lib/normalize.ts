/**
 * Mirror of the backend word normalization (SPEC §6.5) for the typing
 * auto-check: trim → lowercase → NFC → collapse spaces. word_text is already
 * normalized server-side, so normalizing the typed answer the same way and
 * comparing exactly is enough — no fuzzy matching (SPEC §6.7).
 */
export function normalizeWord(input: string): string {
  return input.trim().toLowerCase().normalize("NFC").replace(/\s+/g, " ");
}

export function isTypingCorrect(typed: string, wordText: string): boolean {
  return normalizeWord(typed) === wordText;
}
