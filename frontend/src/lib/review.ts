/** Review data hooks (TanStack Query) over /review/queue and /review/answer. */

import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "./api";
import type { UserWord } from "./words";

export type Rating = "again" | "hard" | "good" | "easy";

/** One deck's share of today's queue (pre-review overview, SPEC §17.1-B3). */
export type DeckQueueCount = {
  deck_id: number;
  deck_name: string;
  due_count: number;
  new_count: number;
};

export type ReviewQueue = {
  due: UserWord[];
  new: UserWord[];
  decks: DeckQueueCount[];
};

/** Fetch the day's queue once. The session is managed locally afterwards
 * (Again re-queues in memory), so this never polls or refetches. */
export function useReviewQueue() {
  return useQuery({
    queryKey: ["review-queue"],
    queryFn: () => api<ReviewQueue>("/api/v1/review/queue"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitAnswer() {
  return useMutation({
    mutationFn: ({ userWordId, rating }: { userWordId: number; rating: Rating }) =>
      api<UserWord>("/api/v1/review/answer", {
        method: "POST",
        body: JSON.stringify({ user_word_id: userWordId, rating }),
      }),
  });
}

/** A card is "new" (no typing step) when it has never been reviewed. */
export function isNewCard(card: UserWord): boolean {
  return card.first_reviewed_at === null;
}
