import type { Metadata } from "next";
import { PrDetailClient } from "./client";

/**
 * Página de detalle de un PR del usuario.
 *
 * Server Component mínimo: solo renderiza el Client Component que carga los
 * datos de Convex (no se puede usar useQuery en server). La metadata se
 * genera con valores genéricos (no podemos leer el PR en server sin cliente
 * Convex, y poner ConvexHttpClient aquí costaría un round-trip extra).
 *
 * La metadata real (title, OG, etc.) la actualiza el Client Component con
 * un useEffect al cargar — ver usePrMeta en el cliente.
 */
export const metadata: Metadata = {
  title: "Tu marca personal | mi-dorsal",
  description:
    "Detalle de tu marca personal: ruta, desnivel, splits por km, dispositivo y zapatillas. Vuelve a tu hilo de dorsales en mi-dorsal.",
  robots: { index: false, follow: false }, // privado del usuario
};

export const dynamic = "force-dynamic";

export default async function PrDetailPage({
  params,
}: {
  // Next 15: `params` es ahora una Promise. Mismo patrón que
  // app/carreras/[slug]/page.tsx.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrDetailClient prId={id} />;
}
