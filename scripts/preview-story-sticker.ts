// =============================================================================
// mi-dorsal — Preview script: story sticker (1080x1920, transparente)
// =============================================================================
// Genera el PNG con renderStorySticker() y lo compone sobre un fondo
// simulado de foto de carrera, para comprobar legibilidad de los paneles
// "cristal" y la posición del logo.
//
// Uso: tsx scripts/preview-story-sticker.ts
// Output: diploma-preview-assets/story-sticker-*.png
// =============================================================================

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { renderStorySticker } from "../lib/share-card/story-sticker";

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

async function compose(stickerBuf: Buffer, bgBuf: Buffer, outPath: string) {
  const composed = await sharp(bgBuf)
    .composite([{ input: stickerBuf, top: 0, left: 0 }])
    .png()
    .toBuffer();
  writeFileSync(outPath, composed);
}

async function main() {
  const outDir = join(process.cwd(), "diploma-preview-assets");
  mkdirSync(outDir, { recursive: true });

  const withPR = await renderStorySticker({
    timeFormatted: "1:59:25",
    paceFormatted: "5:40",
    distanceKm: 21.1,
    isPersonalRecord: true,
  });
  writeFileSync(join(outDir, "story-sticker-pr.png"), withPR);
  console.log("✔ story-sticker-pr.png (" + withPR.length + " bytes)");

  const withoutPR = await renderStorySticker({
    timeFormatted: "0:43:12",
    paceFormatted: "4:18",
    distanceKm: 10,
    isPersonalRecord: false,
  });
  writeFileSync(join(outDir, "story-sticker-no-pr.png"), withoutPR);
  console.log("✔ story-sticker-no-pr.png (" + withoutPR.length + " bytes)");

  await compose(withPR, photoLikeSvg(), join(outDir, "story-sticker-pr-on-photo.png"));
  console.log("✔ story-sticker-pr-on-photo.png");

  await compose(withoutPR, photoLikeSvg(), join(outDir, "story-sticker-no-pr-on-photo.png"));
  console.log("✔ story-sticker-no-pr-on-photo.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
