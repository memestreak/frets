import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/AppShell";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Fretwood's display, text and mono faces (SIL OFL), latin subset, self-hosted so the build
// does not depend on reaching Google Fonts. Glyphs outside latin (♭ ♯ ✕)
// come from the fallback stacks in fretwood.css.
const fraunces = localFont({
  variable: "--font-fraunces",
  src: [{ path: "./fonts/fraunces-600-latin.woff2", weight: "600" }],
});
const figtree = localFont({
  variable: "--font-figtree",
  src: [{ path: "./fonts/figtree-latin.woff2", weight: "400 700" }],
});
const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  src: [{ path: "./fonts/jetbrains-mono-500-latin.woff2", weight: "500" }],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No themeColor: the boot script and `syncThemeColor` make the status
  // bar's metas, to follow the theme picked in the app.
};

export const metadata: Metadata = {
  title: "Frets",
  description: "Learn the guitar fretboard",
  // The name under the icon when added to an iPhone home screen.
  appleWebApp: { title: "Frets" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // On <html>, not <body>: fretwood.css reads these variables at :root.
    // data-theme: Light, the default, even before the boot script runs (which
    // sets the saved or linked choice). suppressHydrationWarning: it may.
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${fraunces.variable} ${figtree.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
