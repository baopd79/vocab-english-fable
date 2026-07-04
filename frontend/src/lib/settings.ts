/** User settings hooks (TanStack Query) over /me/settings (SPEC §6). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./api";

export type UserSettings = {
  new_words_per_day: number;
  max_reviews_per_day: number;
  timezone: string;
};

/** Curated timezone options; the backend still validates against the full IANA
 * database, so this list can grow without a server change. */
export const TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

const settingsKey = ["settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => api<UserSettings>("/api/v1/me/settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserSettings>) =>
      api<UserSettings>("/api/v1/me/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKey, updated);
    },
  });
}

export function settingsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "validation_error") {
    return "Giá trị không hợp lệ. Kiểm tra lại giới hạn (0–100 / 0–1000) và múi giờ.";
  }
  return "Không lưu được cài đặt. Vui lòng thử lại.";
}
