import Link from "next/link";

/** Global footer. The legal links must stay reachable from every page, logged
 * in or not — Google OAuth verification checks for a public privacy policy. */
export function SiteFooter() {
  return (
    <footer className="text-subtle-fg mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-6 text-[13px]">
      <span>© 2026 Vocabun</span>
      <Link href="/privacy" className="hover:text-fg transition-colors">
        Quyền riêng tư
      </Link>
      <Link href="/terms" className="hover:text-fg transition-colors">
        Điều khoản
      </Link>
    </footer>
  );
}
