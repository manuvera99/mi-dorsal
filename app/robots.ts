import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Rutas que NO queremos indexar (privadas, auth, admin, búsqueda interna)
        disallow: [
          "/admin",
          "/admin/*",
          "/sign-in",
          "/sign-in/*",
          "/sign-up",
          "/sign-up/*",
          "/calendario",
          "/calendario/*",
          "/perfil",
          "/perfil/*",
          "/api/*",
          "/test-geo",
          "/_next/*",
        ],
      },
      // Permitir explícitamente a Googlebot y otros bots de calidad
      {
        userAgent: [
          "Googlebot",
          "Googlebot-Image",
          "Googlebot-News",
          "Bingbot",
          "Slurp",
          "DuckDuckBot",
        ],
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/sign-in",
          "/sign-in/*",
          "/sign-up",
          "/sign-up/*",
          "/calendario",
          "/calendario/*",
          "/perfil",
          "/perfil/*",
          "/api/*",
        ],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      // Si en el futuro creamos sitemaps segmentados (hubs/carreras/blog)
      // los añadiremos aquí. Por ahora usamos el sitemap maestro para
      // evitar fragmentar el crawl budget.
    ],
    host: BASE_URL,
  };
}