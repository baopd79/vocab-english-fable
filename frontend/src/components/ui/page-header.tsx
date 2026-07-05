import type { ReactNode } from "react";

/** Standard page heading: big display title, muted subtitle, optional action
 * (button/link) pinned to the right. Navigation lives in the global AppHeader. */
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="animate-card-in flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display truncate text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-fg mt-1.5 text-[15px]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
