"use client";

import { useState } from "react";

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
      className="flex flex-col gap-2 rounded border border-gray-200 p-3"
    >
      <input
        aria-label="Tên deck"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Tên deck"
        maxLength={100}
        className="rounded border border-gray-300 px-2 py-1"
      />
      <textarea
        aria-label="Mô tả"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Mô tả (tùy chọn)"
        maxLength={500}
        rows={2}
        className="rounded border border-gray-300 px-2 py-1"
      />
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || name.trim().length === 0}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}
