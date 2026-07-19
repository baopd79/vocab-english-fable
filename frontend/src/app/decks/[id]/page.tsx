"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AddWordForm } from "@/components/add-word-form";
import { DeckIcon } from "@/components/deck-icon";
import { RequireAuth } from "@/components/require-auth";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { SpeakerButton } from "@/components/ui/speaker-button";
import { useDeck, useSetDeckVisibility, type Deck } from "@/lib/decks";
import {
  useAddWord,
  useDeleteWord,
  useRetryEnrichment,
  useUpdateWord,
  useWord,
  useWords,
  wordErrorMessage,
  wordStatus,
  type UserWord,
  type WordStatus,
  type WordUpdateInput,
} from "@/lib/words";

const STATUS_META: Record<WordStatus, { label: string; variant: BadgeVariant }> = {
  new: { label: "Mới", variant: "neutral" },
  learning: { label: "Đang học", variant: "streak" },
  mastered: { label: "Thành thạo", variant: "primary" },
};

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
  const [sharing, setSharing] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="animate-card-in">
        <Link
          href="/decks"
          className="text-muted-fg hover:text-primary-text text-sm font-semibold transition-colors"
        >
          ← Danh sách deck
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3.5">
          <DeckIcon deckId={deckId} className="h-12 w-12 rounded-[14px]" />
          <h1 className="font-display min-w-0 text-3xl font-extrabold tracking-tight">
            {deckQuery.data?.name ?? "…"}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSharing((open) => !open)}
              aria-expanded={sharing}
              className="border-chip-border bg-surface-2 text-muted-fg hover:text-primary-text hover:bg-surface inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-bold backdrop-blur-md transition-colors"
            >
              <ShareIcon />
              Chia sẻ
            </button>
            <Link
              href={`/decks/${deckId}/cram`}
              className="border-chip-border bg-surface-2 text-muted-fg hover:text-primary-text hover:bg-surface inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-bold backdrop-blur-md transition-colors"
            >
              <LightningIcon />
              Ôn tự do
            </Link>
          </div>
        </div>
        {deckQuery.data?.description && (
          <p className="text-muted-fg mt-2 text-[15px]">{deckQuery.data.description}</p>
        )}
      </header>

      {sharing && deckQuery.data && <SharePanel deck={deckQuery.data} />}

      <AddWordForm
        submitting={addWord.isPending}
        errorMessage={addWord.isError ? wordErrorMessage(addWord.error) : null}
        onSubmit={(word) => addWord.mutateAsync(word)}
      />

      {wordsQuery.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : wordsQuery.isError ? (
        <p className="text-danger-text text-sm">Không tải được danh sách từ.</p>
      ) : wordsQuery.data.results.length === 0 ? (
        <p className="text-muted-fg py-3 text-center text-[15px]">
          Chưa có từ nào. Thêm từ đầu tiên — AI sẽ lo phần còn lại.
        </p>
      ) : (
        <ul className="animate-card-in flex flex-col gap-3">
          {wordsQuery.data.results.map((word) => (
            <li key={word.id} className="glass rounded-[18px] px-5 py-4 sm:px-6">
              <WordRow word={word} deckId={deckId} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Share controls (SPEC §17.2-13): toggle public/private + copy the share
 * link. The link only works while the deck stays public. */
function SharePanel({ deck }: { deck: Deck }) {
  const setVisibility = useSetDeckVisibility();
  const [copied, setCopied] = useState(false);
  const isPublic = deck.visibility === "public";
  const shareUrl = `${window.location.origin}/share/${deck.id}`;

  return (
    <section className="glass animate-card-in flex flex-col gap-3 rounded-[20px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">
            {isPublic ? "Deck đang công khai" : "Deck đang riêng tư"}
          </h2>
          <p className="text-muted-fg text-sm">
            {isPublic
              ? "Ai có link đều xem được và thêm về tài khoản của họ (không kèm tiến độ ôn của bạn)."
              : "Bật công khai để lấy link chia sẻ cho bạn bè."}
          </p>
        </div>
        <Button
          variant={isPublic ? "outline" : "primary"}
          size="sm"
          disabled={setVisibility.isPending}
          onClick={() =>
            setVisibility.mutate({ id: deck.id, visibility: isPublic ? "private" : "public" })
          }
        >
          {isPublic ? "Tắt công khai" : "Bật công khai"}
        </Button>
      </div>
      {isPublic && (
        <div className="flex flex-wrap items-center gap-2.5">
          <code className="border-chip-border bg-surface-2 text-muted-fg min-w-0 truncate rounded-full border-[1.5px] px-3.5 py-2 text-sm">
            {shareUrl}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Đã copy!" : "Copy link"}
          </Button>
        </div>
      )}
      {setVisibility.isError && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          Không đổi được trạng thái chia sẻ. Vui lòng thử lại.
        </p>
      )}
    </section>
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
          Xóa từ <span className="font-bold">{displayed.word_text}</span>?
        </p>
        <div className="flex shrink-0 gap-2.5">
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

  const status = STATUS_META[wordStatus(displayed)];

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2.5">
          <span className="text-lg font-bold">{displayed.word_text}</span>
          <SpeakerButton
            text={displayed.word_text}
            size="sm"
            label={`Phát âm ${displayed.word_text}`}
          />
          {displayed.ipa && <span className="text-subtle-fg text-sm">{displayed.ipa}</span>}
          {displayed.part_of_speech && <Badge variant="primary">{displayed.part_of_speech}</Badge>}
        </p>
        <WordDetails word={displayed} onRetry={() => retry.mutate(word.id)} retry={retry} />
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
        <Badge variant={status.variant} className="tracking-wide uppercase">
          {status.label}
        </Badge>
        <button
          type="button"
          onClick={() => {
            updateWord.reset();
            setEditing(true);
          }}
          className="text-muted-fg hover:text-primary-text cursor-pointer transition-colors"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-danger-text cursor-pointer transition-opacity hover:opacity-70"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}

function WordDetails({
  word,
  onRetry,
  retry,
}: {
  word: UserWord;
  onRetry: () => void;
  retry: { isPending: boolean; isError: boolean; error: unknown };
}) {
  if (word.enrichment_status === "pending") {
    return (
      <p className="text-streak-text animate-soft-pulse mt-1 flex items-center gap-1.5 text-sm font-semibold">
        <SparkleIcon /> Đang tra cứu…
      </p>
    );
  }
  if (word.enrichment_status === "failed") {
    return (
      <div className="mt-1 flex flex-col gap-1">
        <p className="text-danger-text text-sm">
          Tra cứu thất bại.{" "}
          <button
            type="button"
            onClick={onRetry}
            disabled={retry.isPending}
            className="cursor-pointer font-bold underline disabled:opacity-50"
          >
            Thử lại
          </button>
        </p>
        {retry.isError && (
          <p role="alert" className="text-danger-text text-sm">
            {wordErrorMessage(retry.error)}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-0.5 text-sm">
      <p className="text-fg text-[15px]">{word.meaning_vi}</p>
      {word.example_en && (
        <div className="mt-1 flex items-start gap-2">
          <SpeakerButton
            text={word.example_en}
            size="sm"
            label="Phát âm câu ví dụ"
            className="mt-0.5"
          />
          <p className="text-muted-fg min-w-0 italic">
            “{word.example_en}”
            {word.example_vi && (
              <span className="text-subtle-fg block not-italic">{word.example_vi}</span>
            )}
          </p>
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
      <p className="text-subtle-fg -mt-1 text-xs">
        Đổi “Từ” sẽ tra cứu lại bằng AI — nội dung bên dưới sẽ bị ghi đè.
      </p>
      {field("part_of_speech", "Loại từ", 50)}
      {field("ipa", "IPA", 100)}
      {field("meaning_vi", "Nghĩa tiếng Việt", 500)}
      {field("example_en", "Ví dụ (EN)", 1000)}
      {field("example_vi", "Ví dụ (VI)", 1000)}
      {errorMessage && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2.5">
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

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2 2-5.2z" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-3.9M8.6 13.5l6.8 3.9" />
    </svg>
  );
}
