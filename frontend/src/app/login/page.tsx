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
      <div className="glass animate-card-in flex w-full max-w-md flex-col items-center rounded-[28px] px-8 py-12 text-center sm:px-14">
        <div className="bg-primary font-display shadow-[0_5px_0_var(--primary-shadow),0_12px_24px_rgba(88,204,2,0.3)] grid h-16 w-16 place-items-center rounded-[18px] text-[32px] font-extrabold text-white">
          V
        </div>
        <h1 className="font-display mt-5 text-4xl font-extrabold tracking-tight">
          Vocab<span className="text-primary-text">un</span>
        </h1>
        <p className="text-muted-fg mt-2.5 text-base">
          Học từ vựng tiếng Anh cùng AI — mỗi ngày một chút, nhớ mãi không quên.
        </p>
        <div className="mt-8">
          {submitting ? (
            <p className="text-muted-fg text-sm">Đang đăng nhập…</p>
          ) : (
            <GoogleSignInButton onCredential={handleCredential} />
          )}
        </div>
        {error && <p className="text-danger-text mt-4 text-sm font-medium">{error}</p>}
        <p className="text-subtle-fg mt-4 text-[13px]">
          Miễn phí, chỉ cần tài khoản Google của bạn.
        </p>
      </div>
    </main>
  );
}
