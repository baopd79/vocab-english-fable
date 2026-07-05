"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export type DeckFormValues = { name: string; description: string };

export function DeckForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting = false,
  errorMessage,
}: {
  initial?: { name: string; description: string };
  submitLabel: string;
  onSubmit: (values: DeckFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name: name.trim(), description });
      }}
      className="border-border bg-surface-2 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <Input
        aria-label="Tên deck"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Tên deck"
        maxLength={100}
        className="bg-surface"
      />
      <Textarea
        aria-label="Mô tả"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Mô tả (tùy chọn)"
        maxLength={500}
        rows={2}
        className="bg-surface"
      />
      {errorMessage && (
        <p role="alert" className="text-grade-again text-sm font-medium">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2">
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
