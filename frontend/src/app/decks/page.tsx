"use client";

import Link from "next/link";
import { useState } from "react";

import { DeckForm, type DeckFormValues } from "@/components/deck-form";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <PageHeader title="Bộ từ vựng" backHref="/" backLabel="← Trang chủ" />

      {creating ? (
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
      ) : (
        <Button
          className="self-start"
          onClick={() => {
            createDeck.reset();
            setCreating(true);
          }}
        >
          + Tạo deck mới
        </Button>
      )}

      {decksQuery.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : decksQuery.isError ? (
        <p className="text-grade-again text-sm">Không tải được danh sách deck.</p>
      ) : decksQuery.data.results.length === 0 ? (
        <p className="text-muted-fg text-sm">Bạn chưa có deck nào. Tạo deck đầu tiên để bắt đầu.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {decksQuery.data.results.map((deck) => (
            <li key={deck.id} className="border-border bg-surface rounded-2xl border p-4 shadow-sm">
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
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Link
          href={`/decks/${deck.id}`}
          className="font-display hover:text-primary text-lg font-semibold transition-colors"
        >
          {deck.name}
        </Link>
        {deck.description && <p className="text-muted-fg text-sm">{deck.description}</p>}
      </div>
      <div className="flex shrink-0 gap-3 text-sm font-medium">
        <button
          type="button"
          onClick={onEdit}
          className="text-muted-fg hover:text-primary cursor-pointer transition-colors"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-grade-again cursor-pointer transition-opacity hover:opacity-70"
        >
          Xóa
        </button>
      </div>
    </div>
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">
        Xóa deck <span className="font-semibold">{deck.name}</span> và toàn bộ từ trong đó?
      </p>
      <div className="flex shrink-0 gap-2">
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
