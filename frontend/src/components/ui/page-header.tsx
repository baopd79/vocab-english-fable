import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Standard page header: gamified display title + theme toggle + a muted back link. */
export function PageHeader({
  title,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="font-display truncate text-2xl font-bold tracking-tight">{title}</h1>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href={backHref}
          className="text-muted-fg hover:text-primary text-sm font-medium transition-colors"
        >
          {backLabel}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
