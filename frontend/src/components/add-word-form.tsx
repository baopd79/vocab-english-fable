"use client";

import { useState } from "react";

export function AddWordForm({
  onSubmit,
  submitting = false,
  errorMessage,
}: {
  /** Resolves on success (the input clears); rejects on error (input kept). */
  onSubmit: (word: string) => Promise<unknown>;
  submitting?: boolean;
  errorMessage?: string | null;
}) {
  const [word, setWord] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await onSubmit(word.trim());
      setWord("");
    } catch {
      // The parent surfaces the error via errorMessage; keep the input.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label="Từ mới"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          placeholder="Nhập từ tiếng Anh…"
          maxLength={64}
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={submitting || word.trim().length === 0}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Thêm từ
        </button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
