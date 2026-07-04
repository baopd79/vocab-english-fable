/** Stats data hooks (TanStack Query) over /stats/overview and /stats/daily. */

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
