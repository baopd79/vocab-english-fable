"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeakerButton } from "@/components/ui/speaker-button";

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
    <form onSubmit={handleSubmit} className="animate-card-in flex flex-col gap-2">
      <div className="flex gap-2.5">
        <Input
          aria-label="Từ mới"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          placeholder="Nhập từ tiếng Anh, ví dụ: humble…"
          maxLength={64}
          className="h-12 rounded-[14px]"
        />
        <SpeakerButton
          text={word.trim()}
          label="Nghe phát âm từ vừa nhập"
          disabled={word.trim().length === 0}
          className="h-12 w-12 self-center rounded-[14px]"
        />
        <Button
          type="submit"
          size="lg"
          className="shrink-0 rounded-[14px] text-[15px]"
          disabled={submitting || word.trim().length === 0}
        >
          Thêm từ
          <SparkleIcon />
        </Button>
      </div>
      <p className="text-subtle-fg text-[13px]">
        AI sẽ tự tra loại từ, phiên âm IPA, nghĩa tiếng Việt và câu ví dụ.
      </p>
      {errorMessage && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {errorMessage}
        </p>
      )}
    </form>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2 2-5.2zM19 15l1.1 2.9L23 19l-2.9 1.1L19 23l-1.1-2.9L15 19l2.9-1.1L19 15z" />
    </svg>
  );
}
