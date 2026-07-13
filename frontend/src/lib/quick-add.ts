/**
 * Last-used deck for the header quick-add (SPEC §17.2-9, §17.3-Q2). Persists
 * per device in localStorage — same convention as theme and sfx mute. The
 * stored id is only a hint: callers must validate it against the real deck
 * list (the deck may have been deleted or belong to another account).
 */

const LAST_DECK_KEY = "quick-add-deck";

export function getLastDeckId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_DECK_KEY);
    if (raw === null) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setLastDeckId(id: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_DECK_KEY, String(id));
  } catch {
    // Private mode without storage — quick-add just won't remember the deck.
  }
}
