import type { Metadata } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "./providers";

// Display face: chunky grotesque — headings and brand (gamified feel).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "vietnamese"],
});

// Body face: designed for Vietnamese diacritics — all UI/body copy.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vocabun",
  description: "Học từ vựng tiếng Anh với AI",
};

// Runs before first paint: resolve theme (stored preference, else system) and
// stamp it on <html data-theme> so there is no light→dark flash on load.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=d;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${bricolage.variable} ${beVietnam.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <Providers>
          <AppHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
