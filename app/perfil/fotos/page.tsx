import type { Metadata } from "next";
import { PhotoSearchListClient } from "./client";

/**
 * "Encuentra tus fotos" — listado de carreras con álbum de fotos.
 *
 * Server Component mínimo, mismo patrón que app/perfil/pr/[id]/page.tsx:
 * no se puede usar useQuery en server, así que solo renderiza el Client
 * Component que carga los datos reales de Convex.
 */
export const metadata: Metadata = {
  title: "Encuentra tus fotos | mi-dorsal",
  description:
    "Sube una selfie y encuentra automáticamente tus fotos en el álbum de la carrera, sin buscar entre cientos de imágenes.",
  robots: { index: false, follow: false }, // privado del usuario
};

export const dynamic = "force-dynamic";

export default function PhotoSearchListPage() {
  return <PhotoSearchListClient />;
}
