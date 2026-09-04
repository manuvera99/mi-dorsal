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
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
    ],
    scope: "/",
    prefer_related_applications: false,
    screenshots: [
      {
        src: "/og-image",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "mi-dorsal — planificador de carreras",
      },
    ],
    id: BASE_URL,
  };
}
