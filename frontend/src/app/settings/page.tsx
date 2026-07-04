"use client";

import Link from "next/link";
import { useState } from "react";

import { RequireAuth } from "@/components/require-auth";
import {
  settingsErrorMessage,
  TIMEZONES,
  useSettings,
  useUpdateSettings,
  type UserSettings,
} from "@/lib/settings";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}

export function SettingsContent() {
  const query = useSettings();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← Trang chủ
        </Link>
      </header>

      {query.isPending ? (
        <p className="text-sm text-gray-600">Đang tải…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Không tải được cài đặt.</p>
      ) : (
        <SettingsForm initial={query.data} />
      )}
    </main>
  );
}

function SettingsForm({ initial }: { initial: UserSettings }) {
  const update = useUpdateSettings();
  const [newPerDay, setNewPerDay] = useState(String(initial.new_words_per_day));
  const [maxReviews, setMaxReviews] = useState(String(initial.max_reviews_per_day));
  const [timezone, setTimezone] = useState(initial.timezone);
  const [saved, setSaved] = useState(false);

  // Keep the current value selectable even if it is not in the curated list.
  const zones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    update.mutate(
      {
        new_words_per_day: Number(newPerDay),
        max_reviews_per_day: Number(maxReviews),
        timezone,
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <NumberField
        label="Từ mới mỗi ngày"
        hint="0–100, đặt 0 để tạm dừng học từ mới"
        min={0}
        max={100}
        value={newPerDay}
        onChange={setNewPerDay}
      />
      <NumberField
        label="Số lượt ôn tối đa mỗi ngày"
        hint="0–1000, đặt 0 để tạm nghỉ ôn"
        min={0}
        max={1000}
        value={maxReviews}
        onChange={setMaxReviews}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Múi giờ</span>
        <select
          aria-label="Múi giờ"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          Dùng để tính “ngày” cho hàng đợi ôn và streak.
        </span>
      </label>

      {update.isError && (
        <p role="alert" className="text-sm text-red-600">
          {settingsErrorMessage(update.error)}
        </p>
      )}
      {saved && !update.isError && <p className="text-sm text-green-600">Đã lưu.</p>}

      <button
        type="submit"
        disabled={update.isPending}
        className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Lưu
      </button>
    </form>
  );
}

function NumberField({
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-gray-300 px-3 py-2"
      />
      <span className="text-xs text-gray-500">{hint}</span>
    </label>
  );
}
