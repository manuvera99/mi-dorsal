// =============================================================================
// mi-dorsal — Preview script: story sticker (1080x1920)
// =============================================================================
// Genera el PNG con renderStorySticker() y lo compone sobre un fondo
// simulado para comprobar legibilidad y posición del logo.
//
// Themes:
//   - "overlay" (default legacy): PNG transparente con texto blanco +
//     sombra fuerte. Pensado para descargar y superponer sobre la foto
//     del usuario en Stories. Se compone sobre un fondo simulado de
//     foto de carrera.
//   - "email": PNG con fondo crema opaco + textos oscuros sobre paneles
//     blancos. Pensado para incrustarse inline en el email sobre fondo
//     claro. Se compone sobre el body crema del email (--runner-warm)
//     con la card blanca de mi-dorsal centrada — réplica visual de cómo
//     va a quedar en la bandeja.
//
// Uso:
//   tsx scripts/preview-story-sticker.ts                 # ambos themes
//   tsx scripts/preview-story-sticker.ts --theme overlay
//   tsx scripts/preview-story-sticker.ts --theme email
//
// Output: diploma-preview-assets/story-sticker-*.png
// =============================================================================

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { renderStorySticker, StoryStickerTheme } from "../lib/share-card/story-sticker";

const W = 1080;
const H = 1920;

function photoLikeSvg(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7dd3fc"/>
        <stop offset="45%" stop-color="#fca5a5"/>
        <stop offset="100%" stop-color="#292524"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
  </svg>`;
  return Buffer.from(svg);
}

/**
 * Réplica SVG del body del email de mi-dorsal: fondo crema + card blanca
 * centrada con el sticker dentro. Útil para revisar visualmente cómo va
 * a quedar la variante "email" inline en la bandeja.
 */
function emailBodyLikeSvg(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <!-- Body crema, replica del email de mi dorsal -->
    <rect width="${W}" height="${H}" fill="#fafaf9"/>
    <!-- Card blanca del email (560px máx en el original; aquí 820 para que
         el sticker quepa con margen). Redondeo 12px para que coincida con
         el email real. -->
    <rect x="130" y="120" width="${W - 260}" height="${H - 240}" rx="12" ry="12" fill="#ffffff"/>
    <!-- Borde superior del header + línea separadora fina -->
    <line x1="158" y1="200" x2="${W - 158}" y2="200" stroke="#e7e5e4" stroke-width="1"/>
  </svg>`;
  return Buffer.from(svg);
}

async function compose(stickerBuf: Buffer, bgBuf: Buffer, outPath: string) {
  const composed = await sharp(bgBuf)
    .composite([{ input: stickerBuf, top: 0, left: 0 }])
    .png()
    .toBuffer();
  writeFileSync(outPath, composed);
}

function parseThemeArg(): StoryStickerTheme | "both" {
  const arg = process.argv.find((a) => a === "--theme");
  if (!arg) return "both";
  const val = process.argv[process.argv.indexOf(arg) + 1];
  if (val === "overlay" || val === "email" || val === "both") return val;
  console.error(`--theme debe ser "overlay", "email" o "both" (recibido: "${val}")`);
  process.exit(1);
}

async function main() {
  const theme = parseThemeArg();
  const outDir = join(process.cwd(), "diploma-preview-assets");
  mkdirSync(outDir, { recursive: true });

  const themesToRun: StoryStickerTheme[] =
    theme === "both" ? ["overlay", "email"] : [theme];

  for (const t of themesToRun) {
    const suffix = t === "email" ? "-email" : "";

    const withPR = await renderStorySticker(
      {
        timeFormatted: "1:59:25",
        paceFormatted: "5:40",
        distanceKm: 21.1,
        isPersonalRecord: true,
      },
      { theme: t },
    );
    writeFileSync(join(outDir, `story-sticker${suffix}-pr.png`), withPR);
    console.log(`✔ story-sticker${suffix}-pr.png (${withPR.length} bytes)`);

    const withoutPR = await renderStorySticker(
      {
        timeFormatted: "0:43:12",
        paceFormatted: "4:18",
        distanceKm: 10,
        isPersonalRecord: false,
      },
      { theme: t },
    );
    writeFileSync(join(outDir, `story-sticker${suffix}-no-pr.png`), withoutPR);
    console.log(`✔ story-sticker${suffix}-no-pr.png (${withoutPR.length} bytes)`);

    if (t === "overlay") {
      // Composición sobre foto simulada — solo tiene sentido para la
      // variante transparente.
      await compose(withPR, photoLikeSvg(), join(outDir, "story-sticker-pr-on-photo.png"));
      console.log("✔ story-sticker-pr-on-photo.png");
      await compose(
        withoutPR,
        photoLikeSvg(),
        join(outDir, "story-sticker-no-pr-on-photo.png"),
      );
      console.log("✔ story-sticker-no-pr-on-photo.png");
    } else {
      // Composición sobre la réplica del body del email — para ver
      // cómo queda dentro de la card blanca sobre fondo crema.
      await compose(withPR, emailBodyLikeSvg(), join(outDir, "story-sticker-email-pr-in-card.png"));
      console.log("✔ story-sticker-email-pr-in-card.png");
      await compose(
        withoutPR,
        emailBodyLikeSvg(),
        join(outDir, "story-sticker-email-no-pr-in-card.png"),
      );
      console.log("✔ story-sticker-email-no-pr-in-card.png");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
