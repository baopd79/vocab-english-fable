"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        <Input
          aria-label="Từ mới"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          placeholder="Nhập từ tiếng Anh…"
          maxLength={64}
        />
        <Button type="submit" disabled={submitting || word.trim().length === 0}>
          Thêm từ
        </Button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-grade-again text-sm font-medium">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
