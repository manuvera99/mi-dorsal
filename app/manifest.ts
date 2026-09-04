import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mi-dorsal — Planificador de carreras",
    short_name: "mi-dorsal",
    description:
      "Planifica tu temporada de carreras, predice tu tiempo en cada una, y recibe tu resultado oficial por email. El hilo que te une a tu dorsal.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#dc2626",
    lang: "es-ES",
    dir: "ltr",
    categories: ["sports", "health", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
    ],
    scope: "/",
    prefer_related_applications: false,
    screenshots: [
      {
        src: "/og-image.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "mi-dorsal — planificador de carreras",
      },
    ],
    id: BASE_URL,
  };
}
