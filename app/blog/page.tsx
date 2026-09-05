// =============================================================================
// mi-dorsal — /blog (índice "Historias de dorsal")
// =============================================================================
// Grid con todos los posts publicados, paginado, con filtro por categoría.
// Server Component: solo pasa metadata y renderiza el Client (que carga
// los posts vía useQuery).
// =============================================================================

import type { Metadata } from "next";
import { BlogListClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historias de dorsal · Blog de mi-dorsal",
  description:
    "Historias, guías y curiosidades del running popular español. Reportajes, datos reales y un punto de humor para corredores que viven el dorsal.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Historias de dorsal · Blog de mi-dorsal",
    description:
      "Historias, guías y curiosidades del running popular español. Para corredores que viven el dorsal.",
    type: "website",
    url: "/blog",
  },
  keywords: [
    "blog running",
    "blog running España",
    "historias dorsal",
    "carreras populares blog",
    "guías carrera",
    "running popular",
  ],
};

export default function BlogPage() {
  return <BlogListClient />;
}
