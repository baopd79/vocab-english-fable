import type { ReactNode } from "react";

/** Shared shell for the public legal pages (/privacy, /terms). These render
 * without auth — Google OAuth verification and anonymous visitors land here. */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-10 sm:px-8">
      <header className="animate-card-in">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-muted-fg mt-1.5 text-[15px]">Ngày hiệu lực: {effectiveDate}</p>
      </header>
      <article className="animate-card-in mt-8 flex flex-col gap-7">{children}</article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="text-muted-fg flex flex-col gap-2.5 text-[15px] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}
