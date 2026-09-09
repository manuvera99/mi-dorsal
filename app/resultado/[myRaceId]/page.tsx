// =============================================================================
// mi-dorsal — Página pública: /resultado/{myRaceId}
// =============================================================================
// Muestra el resultado oficial de una carrera con botones de descarga y OG
// meta para preview en redes sociales al compartir la URL.
//
// Es PÚBLICA: la URL ya va firmada en el email al corredor y se asume que
// si la comparte, lo hace voluntariamente. Mismo modelo que Strava y
// Runedia.
//
// OG meta: og:image apunta al share card PNG (/api/result/{myRaceId}/share-card.png).
// Si el myRace aún no tiene `shareCardStorageId` (cron no ha corrido), usa
// un fallback (logo de mi-dorsal).
//
// IMPORTANTE: NO exponer email ni datos sensibles en el HTML (robots no
// necesarios; la URL ya es la "autorización").
// =============================================================================

import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ResultadoClient } from "./client";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(/\/$/, "");
const FALLBACK_OG = `${APP_URL}/icon-512.png`; // logo estático si no hay share card

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function getDistanceLabel(distanceM: number): string {
  if (distanceM === 5000) return "5K";
  if (distanceM === 10000) return "10K";
  if (distanceM === 15000) return "15K";
  if (distanceM === 21097) return "Media maratón";
  if (distanceM === 42195) return "Maratón";
  if (distanceM < 21000) return `${(distanceM / 1000).toFixed(0)}K`;
  return `${(distanceM / 1000).toFixed(1)}K`;
}

/**
 * generateMetadata dinámico: usa fetchQuery (server) para leer el myRace
 * y construir og:title/description/image con los datos del resultado.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ myRaceId: string }>;
}): Promise<Metadata> {
  const { myRaceId } = await params;
  const data = await fetchQuery(api.emailNotifications.getMyRaceForPublicPage, {
    myRaceId: myRaceId as Id<"myRaces">,
  }).catch(() => null);

  if (!data || !data.myRace.actualTimeSeconds) {
    return {
      title: "Resultado | mi-dorsal",
      description: "Tu resultado oficial en mi-dorsal.",
      robots: { index: false, follow: true },
    };
  }

  const { profile, race, myRace } = data;
  const distanceM = Math.round(race.distanceKm * 1000);
  const distanceLabel = getDistanceLabel(distanceM);
  const timeFormatted = formatHMS(myRace.actualTimeSeconds);
  const runnerName = profile.displayName ?? "Corredor";
  const ogImageUrl = myRace.shareCardStorageId
    ? `${APP_URL}/api/result/${myRaceId}/share-card.png`
    : FALLBACK_OG;

  const title = `${runnerName} — ${timeFormatted} en ${race.name}`;
  const description = `${runnerName} cruzó la meta de ${race.name} (${distanceLabel}) en ${timeFormatted}. Dorsal ${myRace.dorsalNumber ?? "—"}${myRace.actualPosition ? `, posición ${myRace.actualPosition}.` : "."}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_URL}/resultado/${myRaceId}`,
      siteName: "mi-dorsal",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${runnerName}: ${timeFormatted} en ${race.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ myRaceId: string }>;
}) {
  const { myRaceId } = await params;
  return <ResultadoClient myRaceId={myRaceId} />;
}
