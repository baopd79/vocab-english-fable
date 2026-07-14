/**
 * Cram mode (SPEC §17.2-11): free practice over a whole deck. Read-only by
 * design — the session only ever GETs the deck's words; no answer API call,
 * no ReviewLog, no SRS change.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "./api";
import type { Paginated } from "./decks";
import type { UserWord } from "./words";

/** Page through the deck's words (the list endpoint caps page_size at 100). */
async function fetchAllDeckWords(deckId: number): Promise<UserWord[]> {
  const words: UserWord[] = [];
  let page = 1;
  for (;;) {
    const data = await api<Paginated<UserWord>>(
      `/api/v1/decks/${deckId}/words?page=${page}&page_size=100`,
    );
    words.push(...data.results);
    if (!data.next) return words;
    page += 1;
  }
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Every enrichment-completed word of the deck in a fresh random order.
 * The shuffle lives in the queryFn (render must stay pure — Math.random is
 * lint-banned there), so a refetch deals a new order for the next round. */
export function useCramSession(deckId: number) {
  return useQuery({
    queryKey: ["cram", deckId],
    queryFn: async () => {
      const words = await fetchAllDeckWords(deckId);
      return shuffle(words.filter((word) => word.enrichment_status === "completed"));
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
