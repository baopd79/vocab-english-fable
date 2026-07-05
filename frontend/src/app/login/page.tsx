"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { status, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  async function handleCredential(credential: string) {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle(credential);
      router.replace("/");
    } catch {
      setError("Đăng nhập thất bại. Vui lòng thử lại.");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="border-border bg-surface flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border p-8 text-center shadow-sm">
        <div className="bg-primary text-primary-fg font-display flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold">
          V
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Vocab English</h1>
          <p className="text-muted-fg text-sm">Đăng nhập bằng Google để bắt đầu học</p>
        </div>
        {submitting ? (
          <p className="text-muted-fg text-sm">Đang đăng nhập…</p>
        ) : (
          <GoogleSignInButton onCredential={handleCredential} />
        )}
        {error && <p className="text-grade-again text-sm font-medium">{error}</p>}
      </div>
    </main>
  );
}
