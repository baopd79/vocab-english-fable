"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AddWordForm } from "@/components/add-word-form";
import { RequireAuth } from "@/components/require-auth";
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{deckQuery.data?.name ?? "…"}</h1>
        <Link href="/decks" className="text-sm text-gray-600 hover:underline">
          ← Danh sách deck
        </Link>
      </header>

      <AddWordForm
        submitting={addWord.isPending}
        errorMessage={addWord.isError ? wordErrorMessage(addWord.error) : null}
        onSubmit={(word) => addWord.mutateAsync(word)}
      />

      {wordsQuery.isPending ? (
        <p className="text-sm text-gray-600">Đang tải…</p>
      ) : wordsQuery.isError ? (
        <p className="text-sm text-red-600">Không tải được danh sách từ.</p>
      ) : wordsQuery.data.results.length === 0 ? (
        <p className="text-sm text-gray-600">
          Chưa có từ nào. Thêm từ đầu tiên — AI sẽ tự tra nghĩa, phiên âm và ví dụ.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {wordsQuery.data.results.map((word) => (
            <li key={word.id} className="rounded border border-gray-200 p-3">
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
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          Xóa từ <span className="font-medium">{displayed.word_text}</span>?
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => deleteWord.mutate(word.id)}
            disabled={deleteWord.isPending}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Xóa
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium">
          {displayed.word_text}
          {displayed.ipa && <span className="ml-2 font-normal text-gray-500">{displayed.ipa}</span>}
          {displayed.part_of_speech && (
            <span className="ml-2 text-sm font-normal italic text-gray-500">
              {displayed.part_of_speech}
            </span>
          )}
        </p>
        <WordStatus word={displayed} onRetry={() => retry.mutate(word.id)} retry={retry} />
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => {
            updateWord.reset();
            setEditing(true);
          }}
          className="text-sm text-gray-600 hover:underline"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-600 hover:underline"
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
    return <p className="text-sm text-amber-600">Đang tra cứu…</p>;
  }
  if (word.enrichment_status === "failed") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-red-600">
          Tra cứu thất bại.{" "}
          <button
            type="button"
            onClick={onRetry}
            disabled={retry.isPending}
            className="underline disabled:opacity-50"
          >
            Thử lại
          </button>
        </p>
        {retry.isError && (
          <p role="alert" className="text-sm text-red-600">
            {wordErrorMessage(retry.error)}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="text-sm text-gray-700">
      <p>{word.meaning_vi}</p>
      {word.example_en && (
        <p className="mt-1 text-gray-500">
          {word.example_en}
          {word.example_vi && <span className="block">{word.example_vi}</span>}
        </p>
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-600">{label}</span>
        <input
          aria-label={label}
          value={values[key]}
          maxLength={maxLength}
          onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="flex flex-col gap-2"
    >
      {field("word_text", "Từ", 64)}
      <p className="text-xs text-gray-500">
        Đổi “Từ” sẽ tra cứu lại bằng AI — nội dung bên dưới sẽ bị ghi đè.
      </p>
      {field("part_of_speech", "Loại từ", 50)}
      {field("ipa", "IPA", 100)}
      {field("meaning_vi", "Nghĩa tiếng Việt", 500)}
      {field("example_en", "Ví dụ (EN)", 1000)}
      {field("example_vi", "Ví dụ (VI)", 1000)}
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || values.word_text.trim().length === 0}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Lưu
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
