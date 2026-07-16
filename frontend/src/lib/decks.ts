/** Deck data hooks (TanStack Query) over the /api/v1/decks endpoints. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./api";

export type Deck = {
  id: number;
  name: string;
  description: string;
  visibility: string;
  is_starter: boolean;
  source_deck: number | null;
  word_count: number;
  mastered_count: number;
  created_at: string;
  updated_at: string;
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
