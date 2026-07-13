"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { QuickAdd } from "@/components/quick-add";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth, type AuthUser } from "@/lib/auth-context";
import { useStatsOverview } from "@/lib/stats";

const NAV = [
  { href: "/", label: "Trang chủ" },
  { href: "/review", label: "Ôn tập" },
  { href: "/decks", label: "Bộ từ" },
  { href: "/stats", label: "Thống kê" },
  { href: "/settings", label: "Cài đặt" },
];

/** Global sticky glass header: brand, section nav, streak, avatar, logout.
 * Renders nothing on /login and while the session is not established. */
export function AppHeader() {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();

  if (status !== "authenticated" || !user || pathname === "/login") return null;
  return <HeaderBar pathname={pathname} user={user} onLogout={() => logout()} />;
}

function HeaderBar({
  pathname,
  user,
  onLogout,
}: {
  pathname: string;
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <header className="bg-(--header-bg) border-(--header-border) sticky top-0 z-10 border-b-[1.5px] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="bg-primary font-display shadow-[0_2.5px_0_var(--primary-shadow)] grid h-8 w-8 place-items-center rounded-[9px] text-[17px] font-extrabold text-white">
            V
          </span>
          <span className="font-display hidden text-[19px] font-extrabold tracking-tight lg:inline">
            Vocab<span className="text-primary-text">un</span>
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "bg-primary shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
                    : "text-muted-fg hover:bg-surface-2 hover:text-fg shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <QuickAdd />
          <StreakBadge />
          <ThemeToggle />
          <Avatar user={user} />
          <button
            type="button"
            onClick={onLogout}
            className="text-muted-fg hover:text-fg hidden cursor-pointer text-sm font-semibold transition-colors sm:inline"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}

function StreakBadge() {
  const overview = useStatsOverview();
  if (!overview.data) return null;
  return (
    <span className="bg-streak/15 border-streak/40 text-streak-text hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-bold backdrop-blur-sm sm:flex">
      <FlameIcon />
      {overview.data.streak} ngày
    </span>
  );
}

function Avatar({ user }: { user: AuthUser }) {
  if (user.avatar_url) {
    return (
      <Image
        src={user.avatar_url}
        alt=""
        width={34}
        height={34}
        className="rounded-full"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (user.display_name || user.email).charAt(0).toUpperCase();
  return (
    <span className="bg-streak shadow-[0_2.5px_0_var(--grade-hard-shadow)] grid h-[34px] w-[34px] place-items-center rounded-full text-[15px] font-bold text-white">
      {initial}
    </span>
  );
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 22c4.4 0 7.5-3 7.5-7.2 0-2.9-1.6-5.3-3.3-7.2-.5-.6-1.5-.2-1.5.6 0 1.1-.3 2.2-1 3-.6-2.6-1.8-5.6-4.5-7.7-.6-.5-1.5 0-1.4.8.2 1.9-.5 3.7-1.6 5.4C4.9 11.5 4 13.5 4 15c0 4.1 3.6 7 8 7z" />
    </svg>
  );
}
