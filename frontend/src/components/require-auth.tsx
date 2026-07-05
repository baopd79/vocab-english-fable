"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";

/** Route guard: renders children only when authenticated, else redirects to /login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-fg text-sm">Đang tải…</p>
      </main>
    );
  }
  return <>{children}</>;
}
