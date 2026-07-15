/** Word data hooks (TanStack Query) over the words endpoints (SPEC §7). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./api";
import type { Paginated } from "./decks";

export type EnrichmentStatus = "pending" | "completed" | "failed";

/** How a review asks a card (SPEC §17.2-10) — decided by the backend queue. */
export type ReviewMode = "classic" | "mcq" | "listening";

export type UserWord = {
  id: number;
  deck: number;
  word_text: string;
  part_of_speech: string;
  ipa: string;
  meaning_vi: string;
  example_en: string;
  example_vi: string;
  enrichment_status: EnrichmentStatus;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  first_reviewed_at: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Present on /review/queue items only (SPEC §17.2-10): how to ask this
   * review, plus the 4 shuffled VI meanings when the mode is MCQ. */
  review_mode?: ReviewMode;
  mcq_choices?: string[] | null;
};

export type WordStatus = "new" | "learning" | "mastered";

// Mirror of the backend threshold (SPEC §5): interval ≥ 21 days = mastered.
const MASTERED_INTERVAL_DAYS = 21;

/** Derived word state — never stored, computed the same way as the backend:
 * new = never reviewed; mastered = interval ≥ 21d; learning = the rest. */
export function wordStatus(word: UserWord): WordStatus {
  if (word.first_reviewed_at === null) return "new";
  return word.interval_days >= MASTERED_INTERVAL_DAYS ? "mastered" : "learning";
}

export type WordUpdateInput = Partial<
  Pick<
    UserWord,
    "word_text" | "part_of_speech" | "ipa" | "meaning_vi" | "example_en" | "example_vi"
  >
>;

const wordsKey = (deckId: number) => ["words", deckId] as const;
const wordKey = (id: number) => ["word", id] as const;

export function useWords(deckId: number) {
  return useQuery({
    queryKey: wordsKey(deckId),
    queryFn: () => api<Paginated<UserWord>>(`/api/v1/decks/${deckId}/words`),
  });
}

/** One word, polled every 2s while its enrichment is pending (SPEC §11). */
export function useWord(id: number, initialData?: UserWord) {
  return useQuery({
    queryKey: wordKey(id),
    queryFn: () => api<UserWord>(`/api/v1/words/${id}`),
    initialData,
    refetchInterval: (query) => (query.state.data?.enrichment_status === "pending" ? 2000 : false),
  });
}

export function useAddWord(deckId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (word: string) =>
      api<UserWord>(`/api/v1/decks/${deckId}/words`, {
        method: "POST",
        body: JSON.stringify({ word }),
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(wordKey(created.id), created);
      queryClient.invalidateQueries({ queryKey: wordsKey(deckId) });
    },
  });
}

export function useUpdateWord(deckId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: WordUpdateInput & { id: number }) =>
      api<UserWord>(`/api/v1/words/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(wordKey(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: wordsKey(deckId) });
    },
  });
}

export function useDeleteWord(deckId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/v1/words/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: wordKey(id) });
      queryClient.invalidateQueries({ queryKey: wordsKey(deckId) });
    },
  });
}

export function useRetryEnrichment(deckId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<UserWord>(`/api/v1/words/${id}/retry-enrichment`, { method: "POST" }),
    onSuccess: (word) => {
      queryClient.setQueryData(wordKey(word.id), word);
      queryClient.invalidateQueries({ queryKey: wordsKey(deckId) });
    },
  });
}

/** Map a mutation error to a Vietnamese message the word UI can show. */
export function wordErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "invalid_word")
      return "Từ không hợp lệ — chỉ dùng chữ cái tiếng Anh, dấu nháy đơn và gạch nối.";
    if (error.code === "word_conflict") return "Từ này đã có trong deck.";
    if (error.code === "throttled")
      return "Bạn đã hết lượt tra cứu AI hôm nay. Thử lại vào ngày mai.";
    if (error.code === "ai_budget_exceeded")
      return "Hệ thống đã dùng hết lượt AI hôm nay — thử lại vào ngày mai nhé.";
    if (error.code === "enrichment_not_failed") return "Từ này không ở trạng thái lỗi.";
    if (error.code === "validation_error") return "Dữ liệu không hợp lệ.";
  }
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}
