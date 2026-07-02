"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Vocab English</h1>
      <p className="text-gray-600">Đăng nhập bằng Google để bắt đầu học</p>
      {submitting ? (
        <p className="text-sm text-gray-600">Đang đăng nhập…</p>
      ) : (
        <GoogleSignInButton onCredential={handleCredential} />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
