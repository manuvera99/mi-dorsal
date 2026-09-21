import type { MetadataRoute } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

/**
 * Sitemap principal — agrupa páginas estáticas + landings SEO top (hubs
 * de provincia/distancia + guías + comparativas + blog + carreras).
 *
 * Se regenera cada 6 horas. La lógica de cada bloque vive en su propia
 * helper para mantener este archivo legible.
 */
export const revalidate = 21600; // 6h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let convex: ConvexHttpClient;
  try {
    convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  } catch (err) {
    console.error("[sitemap] Convex client init failed:", err);
    return staticPages();
  }

  const [
    raceEntries,
    blogEntries,
    provinceHubs,
    distanceHubs,
  ] = await Promise.all([
    safe(() => convex.query(api.races.listForSitemap, {})),
    safe(() => convex.query(api.blog.list, { limit: 500 })),
    safe(() => convex.query(api.races.listProvinceHubsForSeo, {})),
    safe(() => convex.query(api.races.listDistanceHubsForSeo, {})),
  ]);

  return [
    ...staticPages(),
    ...provinceHubEntries(provinceHubs),
    ...distanceHubEntries(distanceHubs),
    ...provinceDistanceHubEntries(provinceHubs, distanceHubs),
    ...guiasEntries(),
    ...comparativasEntries(),
    ...blogLandingEntries(),
    ...blogPostEntries(blogEntries),
    ...blogCategoryEntries(),
    ...raceMap(raceEntries),
  ];
}

// =============================================================================
// Static landings
// =============================================================================

function staticPages(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/carreras`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/ranking`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
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
}

function guiasEntries(): MetadataRoute.Sitemap {
  const slugs = [
    "es-legal-vender-dorsal",
    "como-transferir-dorsal",
    "que-pasa-si-no-puedo-correr",
    "como-cambiar-titular-dorsal-maraton",
    "plazo-cambio-titularidad-carrera",
    "como-vender-dorsal-rapido",
    "donde-vender-dorsal-segunda-mano",
    "vender-dorsal-lesion",
    "comparativa-marketplaces-dorsales",
  ];
  return slugs.map((slug) => ({
    url: `${BASE_URL}/guias/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
}

function comparativasEntries(): MetadataRoute.Sitemap {
  const slugs = [
    "mi-dorsal-vs-dorsal-pro",
    "mi-dorsal-vs-wallapop",
    "mi-dorsal-vs-milanuncios",
    "donde-vender-dorsal-maraton",
  ];
  return slugs.map((slug) => ({
    url: `${BASE_URL}/comparativas/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

function blogLandingEntries(): MetadataRoute.Sitemap {
  return [
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
}

function blogCategoryEntries(): MetadataRoute.Sitemap {
  return ["historias", "guias", "curiosidades", "tendencias"].map((cat) => ({
    url: `${BASE_URL}/blog/categoria/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));
}

// =============================================================================
// Hub SEO entries
// =============================================================================

interface ProvinceHub {
  province: string;
  slug: string;
  label: string;
  total: number;
  upcoming: number;
  nextDate?: string;
}

interface DistanceHubSummary {
  slug: string;
  label: string;
  total: number;
  upcoming: number;
  nextDate?: string;
}

function provinceHubEntries(
  hubs: ProvinceHub[] | null,
): MetadataRoute.Sitemap {
  if (!hubs) return [];
  // Solo emitimos hubs con ≥3 carreras publicadas (evita thin pages en sitemap).
  return hubs
    .filter((h) => h.total >= 3)
    .map((h) => ({
      url: `${BASE_URL}/carreras/${h.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
}

function distanceHubEntries(
  hubs: DistanceHubSummary[] | null,
): MetadataRoute.Sitemap {
  if (!hubs) return [];
  return hubs
    .filter((h) => h.total >= 3)
    .map((h) => ({
      url: `${BASE_URL}/carreras/distancia/${h.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
}

function provinceDistanceHubEntries(
  provinces: ProvinceHub[] | null,
  distances: DistanceHubSummary[] | null,
): MetadataRoute.Sitemap {
  if (!provinces || !distances) return [];
  const out: MetadataRoute.Sitemap = [];
  for (const p of provinces) {
    if (p.total < 5) continue;
    for (const d of distances) {
      // Para evitar páginas vacías, solo emitimos combinaciones donde la
      // distancia tiene suficiente volumen global (≥20 carreras en España).
      if (d.total < 20) continue;
      out.push({
        url: `${BASE_URL}/carreras/${p.slug}/${d.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      });
    }
  }
  return out;
}

// =============================================================================
// Races + blog posts (dinámicos)
// =============================================================================

function raceMap(races: any[] | null): MetadataRoute.Sitemap {
  if (!races) return [];
  const today = new Date().toISOString().slice(0, 10);
  return races.map((race: any) => {
    const isFuture = race.startDate && race.startDate >= today;
    const isFeatured = race.isFeatured === true;
    return {
      url: `${BASE_URL}/carreras/${race.slug}`,
      lastModified: race.ingestedAt ? new Date(race.ingestedAt) : new Date(),
      changeFrequency: isFuture ? ("weekly" as const) : ("monthly" as const),
      // Subimos el mínimo: ninguna carrera queda por debajo de 0.5 para que
      // Google mantenga un crawl budget sano sobre todas.
      priority: isFeatured ? 0.9 : isFuture ? 0.8 : 0.5,
    };
  });
}

function blogPostEntries(data: any): MetadataRoute.Sitemap {
  const items = data?.items ?? [];
  return items.map((p: any) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : new Date(),
    changeFrequency: "monthly" as const,
    priority: p.isFeatured ? 0.8 : 0.6,
  }));
}

// =============================================================================
// Helpers
// =============================================================================

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[sitemap] Query failed:", err);
    return null;
  }
}