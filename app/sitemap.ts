import type { MetadataRoute } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

/**
 * Sitemap dinámico.
 * - Indexa todas las carreras publicadas (isPublished=true)
 * - Se regenera cada hora (revalidate = 3600)
 * - Páginas estáticas se priorizan con priority 1.0 y 0.9
 * - Carreras futuras (startDate >= hoy) con priority 0.8
 * - Carreras pasadas con priority 0.4
 */
export const revalidate = 3600; // 1h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/carreras`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/ranking`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/legal/privacidad`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/aviso-legal`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Carreras dinámicas desde Convex
  let raceEntries: MetadataRoute.Sitemap = [];
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const races = await convex.query(api.races.listForSitemap, {});

    const today = new Date().toISOString().slice(0, 10);

    raceEntries = (races ?? []).map((race: any) => {
      const isFuture = race.startDate && race.startDate >= today;
      const isFeatured = race.isFeatured === true;
      return {
        url: `${BASE_URL}/carreras/${race.slug}`,
        lastModified: race.ingestedAt ? new Date(race.ingestedAt) : new Date(),
        changeFrequency: isFuture ? ("weekly" as const) : ("monthly" as const),
        priority: isFeatured ? 0.9 : isFuture ? 0.8 : 0.4,
      };
    });

    // Blog posts (Historias de dorsal)
    try {
      const blogData = await convex.query(api.blog.list, { limit: 500 });
      blogEntries = (blogData?.items ?? []).map((p: any) => ({
        url: `${BASE_URL}/blog/${p.slug}`,
        lastModified: p.publishedAt ? new Date(p.publishedAt) : new Date(),
        changeFrequency: "monthly" as const,
        priority: p.isFeatured ? 0.8 : 0.6,
      }));
    } catch (err) {
      console.error("[sitemap] No se pudieron cargar posts del blog:", err);
    }
  } catch (err) {
    // Si Convex falla, devolvemos solo las páginas estáticas.
    // Esto evita romper el build si Convex está caído.
    console.error("[sitemap] No se pudieron cargar carreras de Convex:", err);
  }

  // Landings de categorías del blog (SEO long tail)
  const categoryEntries: MetadataRoute.Sitemap = [
    "historias",
    "guias",
    "curiosidades",
    "tendencias",
  ].map((cat) => ({
    url: `${BASE_URL}/blog/categoria/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const blogLanding: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/newsletter`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ];

  return [...staticPages, ...raceEntries, ...blogLanding, ...blogEntries, ...categoryEntries];
}
