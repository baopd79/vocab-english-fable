"use client";

import Link from "next/link";
import { useState } from "react";

import { DeckForm, type DeckFormValues } from "@/components/deck-form";
import { RequireAuth } from "@/components/require-auth";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bộ từ vựng</h1>
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← Trang chủ
        </Link>
      </header>

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
        <button
          type="button"
          onClick={() => {
            createDeck.reset();
            setCreating(true);
          }}
          className="self-start rounded bg-black px-4 py-2 text-sm text-white"
        >
          + Tạo deck mới
        </button>
      )}

      {decksQuery.isPending ? (
        <p className="text-sm text-gray-600">Đang tải…</p>
      ) : decksQuery.isError ? (
        <p className="text-sm text-red-600">Không tải được danh sách deck.</p>
      ) : decksQuery.data.results.length === 0 ? (
        <p className="text-sm text-gray-600">Bạn chưa có deck nào. Tạo deck đầu tiên để bắt đầu.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {decksQuery.data.results.map((deck) => (
            <li key={deck.id} className="rounded border border-gray-200 p-3">
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
      <div>
        <Link href={`/decks/${deck.id}`} className="font-medium hover:underline">
          {deck.name}
        </Link>
        {deck.description && <p className="text-sm text-gray-600">{deck.description}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onEdit} className="text-sm text-gray-600 hover:underline">
          Sửa
        </button>
        <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">
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
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm">
        Xóa deck <span className="font-medium">{deck.name}</span> và toàn bộ từ trong đó?
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
