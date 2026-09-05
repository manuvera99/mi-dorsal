// =============================================================================
// mi-dorsal — /blog/categoria/[cat] (landing por categoría)
// =============================================================================
// SEO long-tail: cada categoría tiene su landing con título, descripción y
// grid de posts. Genera metadata única por categoría.
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { BlogListClient } from "../../client";

export const dynamic = "force-dynamic";

const CATEGORY_KEYS = ["historias", "guias", "curiosidades", "tendencias"] as const;
type Category = (typeof CATEGORY_KEYS)[number];

const CATEGORY_META: Record<Category, { title: string; description: string; h1: string; sub: string }> = {
  historias: {
    title: "Historias de dorsal · Reportajes de running popular",
    description:
      "Historias reales de corredores populares: Behobia, San Silvestre, primeras medias maratones. Para los que viven el dorsal, no solo el GPS.",
    h1: "Historias de dorsal",
    sub: "Lo que se siente al cruzar una meta. Reportajes, crónicas y memorias de carrera.",
  },
  guias: {
    title: "Guías de carrera · Consejos prácticos para el corredor popular",
    description:
      "Guías para preparar tu próxima carrera: ruta, perfil, avituallamiento, qué llevar. Datos reales del catálogo de mi-dorsal.",
    h1: "Guías de carrera",
    sub: "Prepara tu próxima carrera con datos reales. Ruta, desnivel, avituallamiento, qué ponerse.",
  },
  curiosidades: {
    title: "Curiosidades del running popular español",
    description:
      "Datos que no esperabas, récords raros, historia del running popular en España.",
    h1: "Curiosidades del running",
    sub: "Récords, historia y datos del running popular español que no esperabas.",
  },
  tendencias: {
    title: "Tendencias con contexto · Lo que se mueve en running",
    description:
      "Lo que se mueve en running (zapatillas, rutas, entrenamiento) con contexto real, no postureo.",
    h1: "Tendencias con contexto",
    sub: "Zapatillas, rutas, entrenamiento. Lo que se mueve, sin postureo ni patrocinios.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  if (!CATEGORY_KEYS.includes(cat as Category)) return { title: "Categoría no encontrada" };
  const m = CATEGORY_META[cat as Category];
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: `/blog/categoria/${cat}` },
    openGraph: { title: m.title, description: m.description, type: "website" },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  if (!CATEGORY_KEYS.includes(cat as Category)) notFound();

  // El client component ya hace el filtro, pero queremos inyectar el H1
  // específico de la categoría. Como el BlogListClient es reutilizado,
  // podríamos pasar la categoría por searchParam o un wrapper. Por ahora,
  // simplemente reusamos el client — la categoría se selecciona con el pill
  // correspondiente.
  return <BlogListClient />;
}
