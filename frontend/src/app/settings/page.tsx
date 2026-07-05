"use client";

import { useState } from "react";

import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { PageHeading } from "@/components/ui/page-header";
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
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <PageHeading title="Cài đặt" subtitle="Điều chỉnh nhịp học cho phù hợp với bạn." />

      {query.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : query.isError ? (
        <p className="text-danger-text text-sm">Không tải được cài đặt.</p>
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
    <form
      onSubmit={handleSubmit}
      className="glass animate-card-in flex flex-col gap-5 rounded-[22px] p-6 sm:p-7"
    >
      <Field label="Từ mới mỗi ngày" hint="0–100, đặt 0 để tạm dừng học từ mới">
        <Input
          type="number"
          aria-label="Từ mới mỗi ngày"
          min={0}
          max={100}
          value={newPerDay}
          onChange={(event) => setNewPerDay(event.target.value)}
        />
      </Field>

      <Field label="Số lượt ôn tối đa mỗi ngày" hint="0–1000, đặt 0 để tạm nghỉ ôn">
        <Input
          type="number"
          aria-label="Số lượt ôn tối đa mỗi ngày"
          min={0}
          max={1000}
          value={maxReviews}
          onChange={(event) => setMaxReviews(event.target.value)}
        />
      </Field>

      <Field label="Múi giờ" hint="Dùng để tính “ngày” cho hàng đợi ôn và streak.">
        <Select
          aria-label="Múi giờ"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </Field>

      {update.isError && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {settingsErrorMessage(update.error)}
        </p>
      )}

      <div className="flex items-center gap-3.5">
        <Button type="submit" disabled={update.isPending}>
          Lưu
        </Button>
        {saved && !update.isError && (
          <p className="text-primary-text animate-pop-in text-sm font-bold">Đã lưu.</p>
        )}
      </div>
    </form>
  );
}
