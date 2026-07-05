"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { AddWordForm } from "@/components/add-word-form";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useDeck } from "@/lib/decks";
import {
  useAddWord,
  useDeleteWord,
  useRetryEnrichment,
  useUpdateWord,
  useWord,
  useWords,
  wordErrorMessage,
  type UserWord,
  type WordUpdateInput,
} from "@/lib/words";

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const deckId = Number(params.id);
  return (
    <RequireAuth>
      <DeckWordsContent deckId={deckId} />
    </RequireAuth>
  );
}

export function DeckWordsContent({ deckId }: { deckId: number }) {
  const deckQuery = useDeck(deckId);
  const wordsQuery = useWords(deckId);
  const addWord = useAddWord(deckId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <PageHeader
        title={deckQuery.data?.name ?? "…"}
        backHref="/decks"
        backLabel="← Danh sách deck"
      />

      <AddWordForm
        submitting={addWord.isPending}
        errorMessage={addWord.isError ? wordErrorMessage(addWord.error) : null}
        onSubmit={(word) => addWord.mutateAsync(word)}
      />

      {wordsQuery.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : wordsQuery.isError ? (
        <p className="text-grade-again text-sm">Không tải được danh sách từ.</p>
      ) : wordsQuery.data.results.length === 0 ? (
        <p className="text-muted-fg text-sm">
          Chưa có từ nào. Thêm từ đầu tiên — AI sẽ tự tra nghĩa, phiên âm và ví dụ.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {wordsQuery.data.results.map((word) => (
            <li key={word.id} className="border-border bg-surface rounded-2xl border p-4 shadow-sm">
              <WordRow word={word} deckId={deckId} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function WordRow({ word, deckId }: { word: UserWord; deckId: number }) {
  // The row owns its own query so a pending word polls itself every 2s.
  const wordQuery = useWord(word.id, word);
  const displayed = wordQuery.data ?? word;

  const updateWord = useUpdateWord(deckId);
  const deleteWord = useDeleteWord(deckId);
  const retry = useRetryEnrichment(deckId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <WordEditForm
        initial={displayed}
        submitting={updateWord.isPending}
        errorMessage={updateWord.isError ? wordErrorMessage(updateWord.error) : null}
        onSubmit={(input) =>
          updateWord.mutate({ id: word.id, ...input }, { onSuccess: () => setEditing(false) })
        }
        onCancel={() => {
          setEditing(false);
          updateWord.reset();
        }}
      />
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Xóa từ <span className="font-semibold">{displayed.word_text}</span>?
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => deleteWord.mutate(word.id)}
            disabled={deleteWord.isPending}
          >
            Xóa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Hủy
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-lg font-semibold">{displayed.word_text}</span>
          {displayed.ipa && <span className="text-muted-fg text-sm">{displayed.ipa}</span>}
          {displayed.part_of_speech && <Badge variant="primary">{displayed.part_of_speech}</Badge>}
        </p>
        <WordStatus word={displayed} onRetry={() => retry.mutate(word.id)} retry={retry} />
      </div>
      <div className="flex shrink-0 gap-3 text-sm font-medium">
        <button
          type="button"
          onClick={() => {
            updateWord.reset();
            setEditing(true);
          }}
          className="text-muted-fg hover:text-primary cursor-pointer transition-colors"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-grade-again cursor-pointer transition-opacity hover:opacity-70"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}

function WordStatus({
  word,
  onRetry,
  retry,
}: {
  word: UserWord;
  onRetry: () => void;
  retry: { isPending: boolean; isError: boolean; error: unknown };
}) {
  if (word.enrichment_status === "pending") {
    return <p className="text-streak mt-1 text-sm font-medium">Đang tra cứu…</p>;
  }
  if (word.enrichment_status === "failed") {
    return (
      <div className="mt-1 flex flex-col gap-1">
        <p className="text-grade-again text-sm">
          Tra cứu thất bại.{" "}
          <button
            type="button"
            onClick={onRetry}
            disabled={retry.isPending}
            className="cursor-pointer font-medium underline disabled:opacity-50"
          >
            Thử lại
          </button>
        </p>
        {retry.isError && (
          <p role="alert" className="text-grade-again text-sm">
            {wordErrorMessage(retry.error)}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1 text-sm">
      <p className="text-fg">{word.meaning_vi}</p>
      {word.example_en && (
        <div className="border-primary/30 mt-1.5 border-l-2 pl-3">
          <p className="text-muted-fg">{word.example_en}</p>
          {word.example_vi && <p className="text-muted-fg">{word.example_vi}</p>}
        </div>
      )}
    </div>
  );
}

function WordEditForm({
  initial,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  initial: UserWord;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: WordUpdateInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Required<WordUpdateInput>>({
    word_text: initial.word_text,
    part_of_speech: initial.part_of_speech,
    ipa: initial.ipa,
    meaning_vi: initial.meaning_vi,
    example_en: initial.example_en,
    example_vi: initial.example_vi,
  });

  function field(key: keyof WordUpdateInput, label: string, maxLength: number) {
    return (
      <Field label={label}>
        <Input
          aria-label={label}
          value={values[key]}
          maxLength={maxLength}
          onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
        />
      </Field>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="flex flex-col gap-3"
    >
      {field("word_text", "Từ", 64)}
      <p className="text-muted-fg -mt-1 text-xs">
        Đổi “Từ” sẽ tra cứu lại bằng AI — nội dung bên dưới sẽ bị ghi đè.
      </p>
      {field("part_of_speech", "Loại từ", 50)}
      {field("ipa", "IPA", 100)}
      {field("meaning_vi", "Nghĩa tiếng Việt", 500)}
      {field("example_en", "Ví dụ (EN)", 1000)}
      {field("example_vi", "Ví dụ (VI)", 1000)}
      {errorMessage && (
        <p role="alert" className="text-grade-again text-sm font-medium">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={submitting || values.word_text.trim().length === 0}
        >
          Lưu
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
