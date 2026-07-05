"use client";

import { useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("GSI script failed to load")));
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      document.head.append(script);
    }
  });
}

export function GoogleSignInButton({
  onCredential,
}: {
  onCredential: (credential: string) => void;
}) {
  // Inlined at build time by Next.js — safe to read during render.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
        });
      })
      .catch(() => setError("Không tải được Google Sign-In. Kiểm tra kết nối mạng."));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId)
    return <p className="text-grade-again text-sm font-medium">Thiếu cấu hình Google Client ID.</p>;
  if (error) return <p className="text-grade-again text-sm font-medium">{error}</p>;
  return <div ref={containerRef} />;
}
