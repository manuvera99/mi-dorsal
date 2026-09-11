"use client";

/**
 * ResultadoClient — vista pública del resultado de una myRace.
 *
 * Carga los datos vía Convex y renderiza:
 *   - El share card PNG embebido (descargable con click derecho / long press)
 *   - Botones de descarga: PNG, diploma PDF
 *   - Botón "Compartir" con Web Share API (móvil) + fallback a URL copy
 *   - Bloque de stats: dorsal, tiempo, posición, PR si aplica
 *
 * Página pública (no requiere auth): la URL ya viene en el email al
 * corredor, y si la comparte asume la responsabilidad. Consistente con
 * Strava / Runedia / Foroatletismo.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatTime, formatPace, formatDate } from "@/lib/utils";
import {
  Trophy,
  Download,
  Share2,
  ExternalLink,
  ArrowLeft,
  MapPin,
  Calendar,
  Hash,
  TrendingDown,
  Check,
  Sparkles,
  Instagram,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const APP_URL = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) || "https://www.mi-dorsal.com";

export function ResultadoClient({ myRaceId }: { myRaceId: string }) {
  const data = useQuery(api.emailNotificationsHelpers.getMyRaceForPublicPage, {
    myRaceId: myRaceId as Id<"myRaces">,
  });
  const [copied, setCopied] = useState(false);

  // Estado de carga
  if (data === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="aspect-[1200/630] bg-gray-50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (data === null || !data.myRace.actualTimeSeconds) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="card text-center">
          <h1 className="text-xl font-bold mb-2">Resultado no disponible</h1>
          <p className="text-sm text-stone-600 mb-4">
            Este resultado aún no se ha publicado, o el enlace es incorrecto.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-semibold text-runner-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la home
          </Link>
        </div>
      </div>
    );
  }

  const { myRace, profile, race, currentPR } = data;
  // Ya validado arriba (!data.myRace.actualTimeSeconds → early return), pero
  // TS no propaga esa narrowing a través de la desestructuración anidada.
  const actualTimeSeconds = myRace.actualTimeSeconds!;
  const distanceM = Math.round(race.distanceKm * 1000);
  const distanceLabel = formatDistanceLabel(distanceM);
  const timeFormatted = formatTime(actualTimeSeconds);
  const paceFormatted = formatPace(
    actualTimeSeconds / Math.max(race.distanceKm, 0.001),
  );
  const runnerName = profile.displayName ?? "Corredor";
  const pageUrl = `${APP_URL}/resultado/${myRaceId}`;
  const pngUrl = `${APP_URL}/api/result/${myRaceId}/share-card.png`;
  const pdfUrl = `${APP_URL}/api/diploma/${myRaceId}`;
  const stickerUrl = `${APP_URL}/api/result/${myRaceId}/story-sticker.png`;
  const hasCard = !!myRace.shareCardStorageId;
  const hasDiploma = !!myRace.diplomaStorageId;
  const hasSticker = !!myRace.storyStickerStorageId;

  const isPR =
    currentPR != null && actualTimeSeconds < currentPR.timeSeconds;
  const prDeltaSeconds = isPR && currentPR
    ? currentPR.timeSeconds - actualTimeSeconds
    : 0;
  const prDeltaFormatted = formatDelta(prDeltaSeconds);

  // ----- Handlers -----
  async function handleShare() {
    const text = `Crucé la meta de ${race.name} (${distanceLabel}) en ${timeFormatted} 🏁`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as any).share({ title: runnerName, text, url: pageUrl });
        return;
      } catch {
        // user cancelado o error → fallback
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${pageUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `🏁 ${timeFormatted} en ${race.name} (${distanceLabel}). Mi dorsal: ${myRace.dorsalNumber ?? "—"}. ${pageUrl}`,
  )}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `🏁 ${timeFormatted} en ${race.name} (${distanceLabel})`,
  )}&url=${encodeURIComponent(pageUrl)}&via=midorsal`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-runner-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Inicio
      </Link>

      {/* Header */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-stone-500 text-xs uppercase tracking-wider font-semibold">
              <Trophy className={`h-4 w-4 ${isPR ? "text-yellow-500" : "text-stone-400"}`} />
              {distanceLabel}
              {isPR && (
                <span className="ml-1 normal-case tracking-normal text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  Nuevo PR
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-runner-dark mt-1.5 leading-tight">
              {runnerName}
            </h1>
            <p className="text-stone-600 text-sm mt-1">{race.name}</p>
          </div>
          <div className="text-right text-sm text-stone-600 flex-shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="h-3.5 w-3.5" />
              {race.startDate ? formatDate(race.startDate) : ""}
            </div>
            {race.locality && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {race.locality}
              </div>
            )}
          </div>
        </div>

        {/* The time (HERO) */}
        <div className="text-center py-4 border-y border-stone-100">
          <div className="text-6xl md:text-7xl font-bold font-mono text-runner-accent leading-none tracking-tight">
            {timeFormatted}
          </div>
          <div className="text-xs text-stone-500 mt-2 uppercase tracking-widest font-semibold">
            Tu tiempo oficial
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <StatTile
            label="Dorsal"
            value={myRace.dorsalNumber ?? "—"}
            icon={<Hash className="h-3 w-3" />}
          />
          <StatTile
            label="Pace"
            value={`${paceFormatted} /km`}
            icon={<TrendingDown className="h-3 w-3" />}
          />
          {myRace.actualPosition != null && (
            <StatTile
              label="Pos. general"
              value={String(myRace.actualPosition)}
            />
          )}
          {myRace.actualPositionCategory != null && (
            <StatTile
              label="Pos. categoría"
              value={String(myRace.actualPositionCategory)}
            />
          )}
        </div>

        {/* PR delta */}
        {isPR && currentPR && (
          <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
            <strong>🎉 Has bajado {prDeltaFormatted}</strong> en {distanceLabel}
            <span className="text-emerald-700 ml-1">
              (antes {formatTime(currentPR.timeSeconds)})
            </span>
          </div>
        )}
      </div>

      {/* Share card visual */}
      <div className="card mb-4">
        <h2 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-1.5">
          <Share2 className="h-4 w-4 text-runner-primary" />
          Tu resultado, listo para compartir
        </h2>
        {hasCard ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pngUrl}
            alt={`${runnerName}: ${timeFormatted} en ${race.name}`}
            width={1200}
            height={630}
            className="w-full h-auto rounded-lg border border-stone-200"
          />
        ) : (
          <div className="aspect-[1200/630] rounded-lg bg-stone-50 flex items-center justify-center text-sm text-stone-500 text-center px-4">
            <div>
              <p>El visual aún se está generando.</p>
              <p className="text-xs mt-1">Vuelve en unos minutos o descárgalo desde tu perfil.</p>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 mt-4">
          <a
            href={pngUrl}
            download={`mi-dorsal-${myRaceId}.png`}
            className="btn bg-runner-primary text-white hover:bg-red-700 inline-flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            Descargar PNG
          </a>
          {hasDiploma && (
            <a
              href={pdfUrl}
              download={`mi-dorsal-diploma-${myRaceId}.pdf`}
              className="btn bg-white border border-runner-primary text-runner-primary hover:bg-red-50 inline-flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Diploma PDF
            </a>
          )}
          {hasSticker && (
            <a
              href={stickerUrl}
              download={`mi-dorsal-story-${myRaceId}.png`}
              className="btn bg-white border border-runner-primary text-runner-primary hover:bg-red-50 inline-flex items-center gap-1.5"
            >
              <Instagram className="h-4 w-4" />
              Descargar para Stories
            </a>
          )}
          <Link
            href={`/editor-sticker/${myRaceId}`}
            className="btn bg-white border border-runner-primary text-runner-primary hover:bg-red-50 inline-flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            Personalizar sticker
          </Link>
          <button
            onClick={handleShare}
            className="btn bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                Enlace copiado
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Compartir
              </>
            )}
          </button>
        </div>

        {/* Redes sociales directas */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-runner-primary"
          >
            WhatsApp
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>·</span>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-runner-primary"
          >
            Twitter / X
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Clasificación completa */}
      {race.resultsUrl && (
        <a
          href={race.resultsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card flex items-center justify-between hover:border-runner-primary transition-colors"
        >
          <div>
            <div className="text-sm font-semibold text-stone-800">Clasificación completa</div>
            <div className="text-xs text-stone-500 mt-0.5">En la web del cronometrador</div>
          </div>
          <ExternalLink className="h-4 w-4 text-stone-400" />
        </a>
      )}

      {/* Footer brand */}
      <p className="text-center text-xs text-stone-400 mt-6 italic">
        El hilo que te une a tu dorsal · mi-dorsal
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-base font-bold font-mono text-runner-dark mt-1">
        {value}
      </div>
    </div>
  );
}

function formatDistanceLabel(distanceM: number): string {
  if (distanceM === 5000) return "5K";
  if (distanceM === 10000) return "10K";
  if (distanceM === 15000) return "15K";
  if (distanceM === 21097) return "Media maratón";
  if (distanceM === 42195) return "Maratón";
  if (distanceM < 21000) return `${(distanceM / 1000).toFixed(0)}K`;
  return `${(distanceM / 1000).toFixed(1)}K`;
}

function formatDelta(seconds: number): string {
  if (seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
