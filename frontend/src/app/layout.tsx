import type { Metadata } from "next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Display face: rounded, playful — headings and buttons (gamified feel).
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
});

// Body face: designed for Vietnamese diacritics — all UI/body copy.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vocab English",
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
      className={`${baloo.variable} ${beVietnam.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
