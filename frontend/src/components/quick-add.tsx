"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeakerButton } from "@/components/ui/speaker-button";
import { useDecks } from "@/lib/decks";
import { getLastDeckId, setLastDeckId } from "@/lib/quick-add";
import { useAddWord, useWord, wordErrorMessage } from "@/lib/words";

/** Header "+" button opening the quick-add modal (SPEC §17.2-9, §17.3-Q2). */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Thêm từ nhanh"
        className="bg-primary shadow-[0_2.5px_0_var(--primary-shadow)] grid h-[34px] w-[34px] shrink-0 cursor-pointer place-items-center rounded-full text-white transition-transform hover:scale-105 active:translate-y-[2px] active:shadow-none"
      >
        <PlusIcon />
      </button>
      {open && <QuickAddModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** Add-words modal, openable from anywhere (header, deck cards). It stays
 * open after each add so several words go in one sitting; the "Vừa thêm"
 * list shows each word's enrichment result live. Errors (duplicate, invalid
 * word) show inside the modal. */
export function QuickAddModal({
  initialDeckId,
  onClose,
}: {
  /** Preselect this deck (e.g. from a deck card) instead of the remembered one. */
  initialDeckId?: number;
  onClose: () => void;
}) {
  const decksQuery = useDecks();
  const decks = decksQuery.data?.results ?? [];

  // The initial id (prop or localStorage) is a hint — fall back to the first
  // deck when it's stale (deck deleted, another account's storage).
  const [pickedId, setPickedId] = useState<number | null>(() => initialDeckId ?? getLastDeckId());
  const selectedId = decks.some((deck) => deck.id === pickedId)
    ? (pickedId as number)
    : (decks[0]?.id ?? null);

  const [word, setWord] = useState("");
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const addWord = useAddWord(selectedId ?? 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedId === null) return;
    try {
      const created = await addWord.mutateAsync(word.trim());
      setLastDeckId(selectedId);
      setAddedIds((prev) => [created.id, ...prev]);
      setWord("");
      inputRef.current?.focus();
    } catch {
      // The error stays visible inside the modal; keep the input.
    }
  }

  // Portal to <body>: the header's backdrop-filter makes it the containing
  // block for position:fixed, which would pin the overlay to the header strip.
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm từ nhanh"
        onClick={(event) => event.stopPropagation()}
        className="glass animate-card-in flex max-h-[85vh] w-full max-w-105 flex-col gap-4 overflow-y-auto rounded-[22px] p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold tracking-tight">Thêm từ nhanh</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-muted-fg hover:text-fg cursor-pointer text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {decksQuery.isPending ? (
          <p className="text-muted-fg text-sm">Đang tải deck…</p>
        ) : decksQuery.isError ? (
          <p className="text-danger-text text-sm">Không tải được danh sách deck.</p>
        ) : decks.length === 0 ? (
          <p className="text-muted-fg text-sm">
            Chưa có deck nào.{" "}
            <Link href="/decks" onClick={onClose} className="text-primary-text font-bold underline">
              Tạo deck đầu tiên
            </Link>{" "}
            rồi quay lại nhé.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex gap-2.5">
                <Input
                  ref={inputRef}
                  aria-label="Từ mới"
                  autoFocus
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                  placeholder="Nhập từ tiếng Anh…"
                  maxLength={64}
                  className="h-12 rounded-[14px]"
                />
                <SpeakerButton
                  text={word.trim()}
                  label="Nghe phát âm từ vừa nhập"
                  disabled={word.trim().length === 0}
                  className="h-12 w-12 self-center rounded-[14px]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">Thêm vào deck</span>
                <div className="flex flex-wrap gap-2">
                  {decks.map((deck) => (
                    <button
                      key={deck.id}
                      type="button"
                      aria-pressed={deck.id === selectedId}
                      onClick={() => {
                        setPickedId(deck.id);
                        addWord.reset();
                      }}
                      className={
                        deck.id === selectedId
                          ? "bg-primary cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-bold text-white"
                          : "border-chip-border bg-surface-2 text-muted-fg hover:text-fg cursor-pointer rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-semibold transition-colors"
                      }
                    >
                      {deck.name}
                    </button>
                  ))}
                </div>
              </div>

              {addWord.isError && (
                <p role="alert" className="text-danger-text text-sm font-medium">
                  {wordErrorMessage(addWord.error)}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="rounded-[14px] text-[15px]"
                disabled={addWord.isPending || word.trim().length === 0}
              >
                Thêm từ
                <SparkleIcon />
              </Button>
              <p className="text-subtle-fg -mt-2 text-[13px]">
                AI sẽ tự tra loại từ, phiên âm IPA, nghĩa tiếng Việt và câu ví dụ.
              </p>
            </form>

            {addedIds.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-subtle-fg text-xs font-bold tracking-wide uppercase">
                  Vừa thêm
                </span>
                <ul className="flex flex-col gap-2">
                  {addedIds.map((id) => (
                    <AddedWordRow key={id} id={id} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** One just-added word — reads the cache seeded by useAddWord and polls
 * itself via useWord while enrichment is pending, so the AI result appears
 * live without closing the modal. */
function AddedWordRow({ id }: { id: number }) {
  const wordQuery = useWord(id);
  const word = wordQuery.data;
  if (!word) return null;
  return (
    <li className="bg-surface-2 border-chip-border flex flex-wrap items-baseline gap-x-2 rounded-xl border-[1.5px] px-3.5 py-2 text-sm">
      <span className="font-bold">{word.word_text}</span>
      {word.enrichment_status === "pending" ? (
        <span className="text-streak-text animate-soft-pulse text-[13px] font-semibold">
          đang tra cứu…
        </span>
      ) : word.enrichment_status === "failed" ? (
        <span className="text-danger-text text-[13px]">
          tra cứu thất bại — thử lại trong trang deck
        </span>
      ) : (
        <span className="text-muted-fg min-w-0 text-[13px]">
          {word.ipa && <span className="text-subtle-fg">{word.ipa} · </span>}
          {word.meaning_vi}
        </span>
      )}
    </li>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2 2-5.2zM19 15l1.1 2.9L23 19l-2.9 1.1L19 23l-1.1-2.9L15 19l2.9-1.1L19 15z" />
    </svg>
  );
}
