"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Vocab English</h1>
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
          <span className="text-muted-fg hidden text-sm sm:inline">
            {user?.display_name || user?.email}
          </span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Đăng xuất
          </Button>
        </div>
      </header>

      <nav className="grid gap-4 sm:grid-cols-2">
        <NavCard
          href="/review"
          title="Ôn tập hôm nay"
          description="Ôn các thẻ tới hạn với lặp lại ngắt quãng"
          icon={<LightningIcon />}
          accent
        />
        <NavCard
          href="/decks"
          title="Bộ từ vựng"
          description="Quản lý deck và thêm từ mới"
          icon={<LayersIcon />}
        />
        <NavCard
          href="/stats"
          title="Thống kê"
          description="Streak, tiến độ và số thẻ đã ôn"
          icon={<ChartIcon />}
        />
        <NavCard
          href="/settings"
          title="Cài đặt"
          description="Giới hạn học và múi giờ"
          icon={<GearIcon />}
        />
      </nav>
    </main>
  );
}

function NavCard({
  href,
  title,
  description,
  icon,
  accent = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group border-border bg-surface hover:border-primary focus-visible:ring-ring focus-visible:ring-offset-bg flex items-center gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span
        className={
          accent
            ? "bg-primary text-primary-fg flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            : "bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="font-display group-hover:text-primary block font-semibold transition-colors">
          {title}
        </span>
        <span className="text-muted-fg block text-sm">{description}</span>
      </span>
    </Link>
  );
}

function LightningIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="7" rx="1" fill="currentColor" stroke="none" />
      <rect x="12" y="6" width="3" height="11" rx="1" fill="currentColor" stroke="none" />
      <rect x="17" y="13" width="3" height="4" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
