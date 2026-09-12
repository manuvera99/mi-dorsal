// =============================================================================
// mi-dorsal — Preview script: email "result-found" en HTML local
// =============================================================================
// Renderiza el template resultFoundEmail() con datos sintéticos y guarda
// el HTML final en diploma-preview-assets/email-result-found.html para
// abrirlo en el navegador y validar visualmente el layout (incluida la
// nueva pieza inline del sticker variante email).
//
// Uso:
//   tsx scripts/preview-result-found-email.ts
// Output:
//   diploma-preview-assets/email-result-found.html (también con/sin PR)
//
// Notas:
// - NO envía nada por Resend. NO toca Convex. NO gasta idempotencia.
// - Para reproducir el cid inline del email real, sustituimos el
//   marcador SHARE_CARD_INLINE por un <img src="..."> apuntando al PNG
//   que ya generó el preview-story-sticker.ts. Si el PNG no existe, el
//   bloque queda como un placeholder visible.
// =============================================================================

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { resultFoundEmail } from "../convex/emails/templates/resultFound";
import { renderDiplomaAsImage, DiplomaImageProps } from "../lib/pdf/diploma-image";

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(timeSeconds: number, distanceKm: number): string {
  if (distanceKm <= 0) return "—";
  const paceSec = timeSeconds / distanceKm;
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const APP_URL = "https://www.mi-dorsal.es";

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Scenario = "with-pr" | "without-pr" | "no-position" | "manual-time";

interface RenderOpts {
  outName: string;
  diplomaPngName: string;
  diplomaPng?: string; // se rellena en main() tras renderizar
  userName: string;
  raceName: string;
  raceDate: string;
  timeSeconds: number;
  distanceKm: number;
  distanceLabel: string;
  positionOverall?: number;
  positionCategory?: number;
  totalRunners?: number;
  predictedTimeSeconds?: number;
  isPersonalRecord: boolean;
  previousRecordFormatted?: string;
  prDeltaSeconds?: number;
  stickerEmailPng?: string; // ruta relativa al HTML; si no, queda placeholder
}

function buildHtml(opts: RenderOpts): string {
  const timeFormatted = formatHMS(opts.timeSeconds);
  const paceFormatted = formatPace(opts.timeSeconds, opts.distanceKm);
  const prediction =
    opts.predictedTimeSeconds !== undefined
      ? {
          predictedTimeFormatted: formatHMS(opts.predictedTimeSeconds),
          errorPct:
            ((opts.timeSeconds - opts.predictedTimeSeconds) / opts.predictedTimeSeconds) *
            100,
        }
      : {};

  const { subject, html } = resultFoundEmail({
    userName: opts.userName,
    raceName: opts.raceName,
    raceDate: opts.raceDate,
    timeFormatted,
    positionOverall: opts.positionOverall,
    positionCategory: opts.positionCategory,
    totalRunners: opts.totalRunners,
    distanceLabel: opts.distanceLabel,
    isPersonalRecord: opts.isPersonalRecord,
    previousRecordFormatted: opts.previousRecordFormatted,
    prDeltaSeconds: opts.prDeltaSeconds,
    classificationUrl: `${APP_URL}/carreras`,
    diplomaUrl: `${APP_URL}/api/diploma/placeholder.pdf`,
    shareUrl: `${APP_URL}/api/result/placeholder/story-sticker.png`,
    stickerEditorUrl: `${APP_URL}/editor-sticker/placeholder`,
    appUrl: APP_URL,
    ...prediction,
  });

  // Reemplaza los marcadores DIPLOMA_INLINE y SHARE_CARD_INLINE por
  // <img> que apunten a los PNGs generados. Si no existen, deja
  // placeholders visibles (cuadrados crema con texto) para que se vea
  // exactamente cómo quedaría cuando el cid no carga en un cliente.
  const diplomaImg = opts.diplomaPng
    ? `<img src="${opts.diplomaPng}" alt="Tu diploma de ${escapeAttr(opts.raceName)}" width="560" style="display:block;max-width:100%;height:auto;border:0;" />`
    : `<div style="width:560px;height:240px;background:#fafaf9;border:1px dashed #a8a29e;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#78716c;font-size:11px;font-family:ui-monospace,monospace;text-align:center;padding:12px;">[diploma preview: PNG no encontrado]</div>`;

  const stickerImg = opts.stickerEmailPng
    ? `<img src="${opts.stickerEmailPng}" alt="Tu resultado en ${escapeAttr(opts.raceName)}" width="240" style="display:block;max-width:100%;height:auto;" />`
    : `<div style="width:240px;height:240px;background:#fafaf9;border:1px dashed #a8a29e;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#78716c;font-size:11px;font-family:ui-monospace,monospace;text-align:center;padding:12px;">[sticker email: PNG no encontrado — ejecuta primero scripts/preview-story-sticker.ts]</div>`;

  const htmlWithInline = html
    .replace(/<!--DIPLOMA_INLINE-->/g, diplomaImg)
    .replace(/<!--SHARE_CARD_INLINE-->/g, stickerImg);

  return `<!-- subject: ${subject} -->\n${htmlWithInline}`;
}

async function main() {
  const outDir = join(process.cwd(), "diploma-preview-assets");
  mkdirSync(outDir, { recursive: true });

  const stickerEmailPR = existsSync(join(outDir, "story-sticker-email-pr.png"));
  const stickerEmailNoPR = existsSync(join(outDir, "story-sticker-email-no-pr.png"));
  const stickerPR = stickerEmailPR ? "story-sticker-email-pr.png" : undefined;
  const stickerNoPR = stickerEmailNoPR ? "story-sticker-email-no-pr.png" : undefined;

  const scenarios: RenderOpts[] = [
    {
      outName: "email-result-found-with-pr.html",
      diplomaPngName: "diploma-preview-pr.png",
      userName: "Manu",
      raceName: "Maratón Valencia 2026",
      raceDate: "domingo, 7 de diciembre de 2025",
      timeSeconds: 11700, // 3:15:00
      distanceKm: 42.195,
      distanceLabel: "Maratón",
      positionOverall: 1847,
      positionCategory: 412,
      totalRunners: 28500,
      predictedTimeSeconds: 12000, // estimación más lenta → mejor de lo pensado
      isPersonalRecord: true,
      previousRecordFormatted: "3:17:54",
      prDeltaSeconds: 174, // 3:17:54 - 3:15:00 = 174s
      stickerEmailPng: stickerPR,
    },
    {
      outName: "email-result-found-without-pr.html",
      diplomaPngName: "diploma-preview-no-pr.png",
      userName: "Manu",
      raceName: "10K Nocturno Alicante",
      raceDate: "sábado, 14 de junio de 2025",
      timeSeconds: 2592, // 0:43:12
      distanceKm: 10,
      distanceLabel: "10K",
      positionOverall: 67,
      positionCategory: 14,
      totalRunners: 1200,
      predictedTimeSeconds: 2520, // estimación más rápida → +2.9%
      isPersonalRecord: false,
      stickerEmailPng: stickerNoPR,
    },
  ];

  for (const s of scenarios) {
    // 1. Render diploma PNG (842x595 A4 landscape)
    const diplomaProps: DiplomaImageProps = {
      runnerName: s.userName,
      raceName: s.raceName,
      raceDate: s.raceDate,
      distanceKm: s.distanceKm,
      distanceLabel: s.distanceLabel,
      timeFormatted: formatHMS(s.timeSeconds),
      dorsalNumber: "4287",
      paceFormatted: formatPace(s.timeSeconds, s.distanceKm),
      positionOverall: s.positionOverall,
      totalRunners: s.totalRunners,
      positionCategory: s.positionCategory,
      isPersonalRecord: s.isPersonalRecord,
      previousRecordFormatted: s.previousRecordFormatted,
      prDeltaSeconds: s.prDeltaSeconds,
      verificationId: "MD-4287-20251207",
      appUrl: APP_URL,
    };
    const diplomaPng = await renderDiplomaAsImage(diplomaProps);
    writeFileSync(join(outDir, s.diplomaPngName), diplomaPng);
    console.log(`✔ ${s.diplomaPngName} (${diplomaPng.length} bytes)`);

    // 2. Render HTML del email con la preview inline apuntando al diploma PNG
    s.diplomaPng = s.diplomaPngName;
    const filePath = join(outDir, s.outName);
    writeFileSync(filePath, buildHtml(s), "utf-8");
    console.log(`✔ ${s.outName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
