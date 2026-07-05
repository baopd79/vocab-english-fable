"use client";

import Link from "next/link";
import { useState } from "react";

import { DeckForm, type DeckFormValues } from "@/components/deck-form";
import { DeckIcon } from "@/components/deck-icon";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-header";
import {
  deckErrorMessage,
  useCreateDeck,
  useDecks,
  useDeleteDeck,
  useUpdateDeck,
  type Deck,
} from "@/lib/decks";

export default function DecksPage() {
  return (
    <RequireAuth>
      <DecksContent />
    </RequireAuth>
  );
}

export function DecksContent() {
  const decksQuery = useDecks();
  const createDeck = useCreateDeck();
  const updateDeck = useUpdateDeck();
  const deleteDeck = useDeleteDeck();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  function handleCreate(values: DeckFormValues) {
    createDeck.mutate(values, { onSuccess: () => setCreating(false) });
  }

  function handleUpdate(id: number, values: DeckFormValues) {
    updateDeck.mutate({ id, ...values }, { onSuccess: () => setEditingId(null) });
  }

  function handleDelete(id: number) {
    deleteDeck.mutate(id, { onSuccess: () => setConfirmingId(null) });
  }

  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <PageHeading
        title="Bộ từ vựng"
        subtitle="Gom từ theo chủ đề để học có hệ thống hơn."
        action={
          !creating && (
            <Button
              onClick={() => {
                createDeck.reset();
                setCreating(true);
              }}
            >
              + Tạo deck mới
            </Button>
          )
        }
      />

      {creating && (
        <DeckForm
          submitLabel="Tạo"
          submitting={createDeck.isPending}
          errorMessage={createDeck.isError ? deckErrorMessage(createDeck.error) : null}
          onSubmit={handleCreate}
          onCancel={() => {
            setCreating(false);
            createDeck.reset();
          }}
        />
      )}

      {decksQuery.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : decksQuery.isError ? (
        <p className="text-danger-text text-sm">Không tải được danh sách deck.</p>
      ) : decksQuery.data.results.length === 0 ? (
        <p className="text-muted-fg text-sm">Bạn chưa có deck nào. Tạo deck đầu tiên để bắt đầu.</p>
      ) : (
        <ul className="animate-card-in grid gap-4 sm:grid-cols-2">
          {decksQuery.data.results.map((deck) => (
            <li key={deck.id} className="glass flex flex-col gap-3 rounded-[20px] p-5 sm:p-6">
              {editingId === deck.id ? (
                <DeckForm
                  initial={{ name: deck.name, description: deck.description }}
                  submitLabel="Lưu"
                  submitting={updateDeck.isPending}
                  errorMessage={updateDeck.isError ? deckErrorMessage(updateDeck.error) : null}
                  onSubmit={(values) => handleUpdate(deck.id, values)}
                  onCancel={() => {
                    setEditingId(null);
                    updateDeck.reset();
                  }}
                  bare
                />
              ) : confirmingId === deck.id ? (
                <DeleteConfirm
                  deck={deck}
                  pending={deleteDeck.isPending}
                  onConfirm={() => handleDelete(deck.id)}
                  onCancel={() => setConfirmingId(null)}
                />
              ) : (
                <DeckRow
                  deck={deck}
                  onEdit={() => {
                    updateDeck.reset();
                    setEditingId(deck.id);
                  }}
                  onDelete={() => setConfirmingId(deck.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DeckRow({
  deck,
  onEdit,
  onDelete,
}: {
  deck: Deck;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/decks/${deck.id}`} className="group flex min-w-0 flex-col gap-2">
          <DeckIcon deckId={deck.id} className="h-10 w-10 rounded-xl" />
          <span className="group-hover:text-primary-text text-[17px] font-bold transition-colors">
            {deck.name}
          </span>
          {deck.description && <span className="text-muted-fg text-sm">{deck.description}</span>}
        </Link>
        <div className="flex shrink-0 gap-3 text-sm font-semibold">
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-fg hover:text-primary-text cursor-pointer transition-colors"
          >
            Sửa
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-danger-text cursor-pointer transition-opacity hover:opacity-70"
          >
            Xóa
          </button>
        </div>
      </div>
      <div className="mt-auto flex gap-2">
        <Badge variant="neutral">{deck.word_count} từ</Badge>
        <Badge variant="primary">{deck.mastered_count} thành thạo</Badge>
      </div>
    </>
  );
}

function DeleteConfirm({
  deck,
  pending,
  onConfirm,
  onCancel,
}: {
  deck: Deck;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Xóa deck <span className="font-bold">{deck.name}</span> và toàn bộ từ trong đó?
      </p>
      <div className="flex gap-2.5">
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={pending}>
          Xóa
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </div>
  );
}
