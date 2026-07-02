"use client";

import Image from "next/image";

import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}

function HomeContent() {
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vocab English</h1>
        <div className="flex items-center gap-3">
          {user?.avatar_url && (
            <Image
              src={user.avatar_url}
              alt=""
              width={32}
              height={32}
              className="rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="text-sm">{user?.display_name || user?.email}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <p className="text-gray-600">Deck của bạn sẽ xuất hiện ở đây.</p>
    </main>
  );
}
