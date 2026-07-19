"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpeakerButton } from "@/components/ui/speaker-button";
import { useAuth, type AuthStatus } from "@/lib/auth-context";
import {
  deckErrorMessage,
  useCloneDeck,
  usePublicDeck,
  usePublicDeckWords,
  type PublicWord,
} from "@/lib/decks";

/** Public share page (SPEC §17.2-13, §17.3-Q4): anyone with the link can
 * look — deliberately NOT wrapped in RequireAuth. Cloning needs a session. */
export default function SharePage() {
  const params = useParams<{ id: string }>();
  return <ShareContent deckId={Number(params.id)} />;
}

export function ShareContent({ deckId }: { deckId: number }) {
  const { status } = useAuth();
  const deckQuery = usePublicDeck(deckId);

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      {/* The app header hides itself for guests — give them a brand mark. */}
      {status !== "authenticated" && (
        <Link href="/" className="flex items-center gap-2.5">
          <span className="bg-primary font-display shadow-[0_2.5px_0_var(--primary-shadow)] grid h-8 w-8 place-items-center rounded-[9px] text-[17px] font-extrabold text-white">
            V
          </span>
          <span className="font-display text-[19px] font-extrabold tracking-tight">
            Vocab<span className="text-primary-text">un</span>
          </span>
        </Link>
      )}

      {deckQuery.isPending ? (
        <p className="text-muted-fg text-sm">Đang tải…</p>
      ) : deckQuery.isError ? (
        <div className="animate-card-in glass flex flex-col items-start gap-3 rounded-[20px] p-6">
          <p className="text-[15px] font-semibold">
            Deck này không tồn tại hoặc không còn công khai.
          </p>
          <Link href="/" className="text-primary-text text-sm font-bold hover:underline">
            Về trang chủ →
          </Link>
        </div>
      ) : (
        <>
          <header className="animate-card-in glass flex flex-col gap-3 rounded-[20px] p-6">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                {deckQuery.data.name}
              </h1>
              <p className="text-muted-fg mt-1 text-sm">
                Deck của <span className="font-semibold">{deckQuery.data.owner_name}</span> ·{" "}
                {deckQuery.data.word_count} từ
              </p>
            </div>
            {deckQuery.data.description && (
              <p className="text-muted-fg text-[15px]">{deckQuery.data.description}</p>
            )}
            <CloneCta deckId={deckId} authStatus={status} />
          </header>
          <ShareWordList deckId={deckId} />
        </>
      )}
    </main>
  );
}

/** Clone CTA per auth state: guests get a login link, users get one click.
 * SRS progress never travels with a clone and no AI quota is spent. */
function CloneCta({ deckId, authStatus }: { deckId: number; authStatus: AuthStatus }) {
  const clone = useCloneDeck();

  if (authStatus === "loading") return null;
  if (authStatus === "unauthenticated") {
    return (
      <Link
        href="/login"
        className="bg-primary text-primary-fg shadow-[0_4px_0_var(--primary-shadow)] hover:bg-primary-hover inline-flex h-11 items-center justify-center self-start rounded-full px-5 text-sm font-bold transition-colors"
      >
        Đăng nhập để thêm về tài khoản
      </Link>
    );
  }
  if (clone.isSuccess) {
    return (
      <p className="text-[15px] font-semibold">
        Đã thêm về tài khoản của bạn! 🎉{" "}
        <Link href="/decks" className="text-primary-text hover:underline">
          Xem bộ từ của tôi →
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        className="self-start"
        disabled={clone.isPending}
        onClick={() => clone.mutate(deckId)}
      >
        + Thêm về tài khoản
      </Button>
      {clone.isError && (
        <p role="alert" className="text-danger-text text-sm font-medium">
          {deckErrorMessage(clone.error)}
        </p>
      )}
    </div>
  );
}

function ShareWordList({ deckId }: { deckId: number }) {
  const wordsQuery = usePublicDeckWords(deckId);

  if (wordsQuery.isPending) return <p className="text-muted-fg text-sm">Đang tải danh sách từ…</p>;
  if (wordsQuery.isError)
    return <p className="text-danger-text text-sm">Không tải được danh sách từ.</p>;

  const words = wordsQuery.data.pages.flatMap((page) => page.results);
  if (words.length === 0)
    return <p className="text-muted-fg py-3 text-center text-[15px]">Deck này chưa có từ nào.</p>;

  return (
    <section className="animate-card-in flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {words.map((word) => (
          <li key={word.id} className="glass rounded-[18px] px-5 py-4 sm:px-6">
            <ShareWordRow word={word} />
          </li>
        ))}
      </ul>
      {wordsQuery.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          disabled={wordsQuery.isFetchingNextPage}
          onClick={() => wordsQuery.fetchNextPage()}
        >
          Tải thêm
        </Button>
      )}
    </section>
  );
}

/** Read-only version of the deck-detail word row — content only, no SRS
 * status, no edit/delete (this is someone else's deck). */
function ShareWordRow({ word }: { word: PublicWord }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex flex-wrap items-center gap-2.5">
        <span className="text-lg font-bold">{word.word_text}</span>
        <SpeakerButton text={word.word_text} size="sm" label={`Phát âm ${word.word_text}`} />
        {word.ipa && <span className="text-subtle-fg text-sm">{word.ipa}</span>}
        {word.part_of_speech && <Badge variant="primary">{word.part_of_speech}</Badge>}
      </p>
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
    </div>
  );
}
