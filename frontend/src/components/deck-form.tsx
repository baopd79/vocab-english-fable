"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type DeckFormValues = { name: string; description: string };

export function DeckForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting = false,
  errorMessage,
  bare = false,
}: {
  initial?: { name: string; description: string };
  submitLabel: string;
  onSubmit: (values: DeckFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
  /** Skip the card chrome when the form already sits inside a glass card. */
  bare?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name: name.trim(), description });
      }}
      className={cn(
        "animate-card-in flex flex-col gap-3",
        !bare && "glass rounded-[20px] p-5 sm:p-6",
      )}
    >
      <Input
        aria-label="Tên deck"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Tên deck, ví dụ: Từ vựng nấu ăn"
        maxLength={100}
      />
      <Textarea
        aria-label="Mô tả"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Mô tả (tùy chọn)"
        maxLength={500}
        rows={2}
      />
      {errorMessage && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2.5">
        <Button type="submit" size="sm" disabled={submitting || name.trim().length === 0}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}
