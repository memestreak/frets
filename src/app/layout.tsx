import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Barlow (SIL OFL), latin subset, self-hosted so the build does not depend
// on reaching Google Fonts. Headings use it too: the design system's Barlow
// Condensed read as too narrow.
const barlow = localFont({
  variable: "--font-barlow",
  src: [
    { path: "./fonts/barlow-400.woff2", weight: "400" },
    { path: "./fonts/barlow-500.woff2", weight: "500" },
    { path: "./fonts/barlow-700.woff2", weight: "700" },
  ],
});

// Monoton (SIL OFL), latin subset: the wordmark in the nav only.
const monoton = localFont({
  variable: "--font-monoton",
  src: [{ path: "./fonts/monoton-400.woff2", weight: "400" }],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Frets",
  description: "Guitar fretboard trainers: intervals and notes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // On <html>, not <body>: globals.css reads these variables at :root.
    <html
      lang="en"
      className={`${barlow.variable} ${monoton.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
