import type { MetadataRoute } from "next";
import { SURFACE_COLORS } from "@/lib/theme";

// Makes the app installable: "Install app" in Chrome, and a full-screen
// launch from an iPhone home screen. Icons are rendered by `npm run icons`.

// The static export can only emit a metadata route that says it's static.
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frets",
    short_name: "Frets",
    description: "Learn the guitar fretboard",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: SURFACE_COLORS.light,
    theme_color: SURFACE_COLORS.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
