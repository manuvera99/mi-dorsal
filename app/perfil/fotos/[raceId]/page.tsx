import type { Metadata } from "next";
import { PhotoSearchDetailClient } from "./client";

export const metadata: Metadata = {
  title: "Encuentra tus fotos | mi-dorsal",
  description: "Sube una selfie y encuentra tus fotos en el álbum de esta carrera.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PhotoSearchDetailPage({
  params,
}: {
  // Next 15: `params` es una Promise — mismo patrón que app/perfil/pr/[id]/page.tsx.
  params: Promise<{ raceId: string }>;
}) {
  const { raceId } = await params;
  return <PhotoSearchDetailClient raceId={raceId} />;
}
