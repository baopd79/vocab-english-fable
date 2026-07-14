/** Stats data hooks (TanStack Query) over the /stats endpoints. */

import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export type StatsOverview = {
  new: number;
  learning: number;
  mastered: number;
  streak: number;
  reviewed_today: number;
};

export type DailyPoint = { date: string; count: number };

export function useStatsOverview() {
  return useQuery({
    queryKey: ["stats-overview"],
    queryFn: () => api<StatsOverview>("/api/v1/stats/overview"),
  });
}

export function useDailyReviews(days = 30) {
  return useQuery({
    queryKey: ["stats-daily", days],
    queryFn: () => api<{ results: DailyPoint[] }>(`/api/v1/stats/daily?days=${days}`),
  });
}

/** 365 days of total review counts ("số lượt ôn"), oldest first, zero-filled. */
export function useReviewHeatmap() {
  return useQuery({
    queryKey: ["stats-heatmap"],
    queryFn: () => api<{ results: DailyPoint[] }>("/api/v1/stats/heatmap"),
  });
}
