/** Deck data hooks (TanStack Query) over the /api/v1/decks endpoints. */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./api";

export type DeckVisibility = "private" | "public";

export type Deck = {
  id: number;
  name: string;
  description: string;
  visibility: DeckVisibility;
  is_starter: boolean;
  source_deck: number | null;
  word_count: number;
  mastered_count: number;
  created_at: string;
  updated_at: string;
};

/** Share-page shape (SPEC §17.3-Q4) — owner display name, never the email. */
export type PublicDeck = {
  id: number;
  name: string;
  description: string;
  owner_name: string;
  word_count: number;
};

/** Word row on the share page: content only, no SRS/enrichment state. */
export type PublicWord = {
  id: number;
  word_text: string;
  part_of_speech: string;
  ipa: string;
  meaning_vi: string;
  example_en: string;
  example_vi: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type DeckInput = { name: string; description?: string };

const decksKey = ["decks"] as const;

export function useDecks() {
  return useQuery({
    queryKey: decksKey,
    queryFn: () => api<Paginated<Deck>>("/api/v1/decks"),
  });
}

export function useDeck(id: number) {
  return useQuery({
    queryKey: ["deck", id] as const,
    queryFn: () => api<Deck>(`/api/v1/decks/${id}`),
  });
}

/** System starter decks anyone can clone (SPEC §17.2-3). */
export function useStarterDecks() {
  return useQuery({
    queryKey: ["starter-decks"] as const,
    queryFn: () => api<Paginated<Deck>>("/api/v1/decks/starter"),
  });
}

/** The public share page for one deck — works without a session; a private
 * or missing deck is a plain 404 (no retry: the answer won't change). */
export function usePublicDeck(id: number) {
  return useQuery({
    queryKey: ["public-deck", id] as const,
    queryFn: () => api<PublicDeck>(`/api/v1/decks/${id}/public`),
    retry: false,
  });
}

/** Paginated word list of a public deck, accumulated page by page. */
export function usePublicDeckWords(id: number) {
  return useInfiniteQuery({
    queryKey: ["public-deck-words", id] as const,
    queryFn: ({ pageParam }) =>
      api<Paginated<PublicWord>>(`/api/v1/decks/${id}/public/words?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    retry: false,
  });
}

/** Owner-only toggle between private and public (SPEC §17.2-13). */
export function useSetDeckVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, visibility }: { id: number; visibility: DeckVisibility }) =>
      api<Deck>(`/api/v1/decks/${id}`, { method: "PATCH", body: JSON.stringify({ visibility }) }),
    onSuccess: (deck) => {
      queryClient.setQueryData(["deck", deck.id], deck);
      queryClient.invalidateQueries({ queryKey: decksKey });
    },
  });
}

/** Clone a starter deck into the user's account — copies content, never
 * SRS progress, and costs no AI quota. */
export function useCloneDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Deck>(`/api/v1/decks/${id}/clone`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: decksKey }),
  });
}

export function useCreateDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeckInput) =>
      api<Deck>("/api/v1/decks", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: decksKey }),
  });
}

export function useUpdateDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: DeckInput & { id: number }) =>
      api<Deck>(`/api/v1/decks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: decksKey }),
  });
}

export function useDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/v1/decks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: decksKey }),
  });
}

/** Map a mutation error to a Vietnamese message the deck forms can show. */
export function deckErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "deck_name_conflict") return "Tên deck đã tồn tại.";
    if (error.code === "validation_error") return "Tên deck không hợp lệ.";
  }
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}
