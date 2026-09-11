// =============================================================================
// mi-dorsal — Carga de fuentes compartida para renders satori (@vercel/og)
// =============================================================================
// Usada por lib/share-card/render.tsx y lib/share-card/story-sticker.tsx.
//
// Las TTF están en lib/pdf/fonts/ y se incluyen en el bundle de Vercel
// mediante next.config.js outputFileTracingIncludes (mismo patrón que
// diploma.tsx). Cargamos desde disco para evitar latencia de red y
// dependencias de terceros en tiempo de generación.
// =============================================================================

import { readFileSync } from "fs";
import { join } from "path";

export type SatoriFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
};

let _fontsCache: SatoriFont[] | null = null;

function loadFonts(): SatoriFont[] {
  const fontsDir = join(process.cwd(), "lib", "pdf", "fonts");
  const interRegular = readFileSync(join(fontsDir, "Inter-Regular.ttf"));
  const interBold = readFileSync(join(fontsDir, "Inter-Bold.ttf"));
  const jetRegular = readFileSync(join(fontsDir, "JetBrainsMono-Regular.ttf"));
  const jetBold = readFileSync(join(fontsDir, "JetBrainsMono-Bold.ttf"));

  return [
    { name: "Inter", data: interRegular, weight: 400, style: "normal" },
    { name: "Inter", data: interBold, weight: 700, style: "normal" },
    { name: "JetBrains Mono", data: jetRegular, weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: jetBold, weight: 700, style: "normal" },
  ];
}

export function getFonts(): SatoriFont[] {
  if (!_fontsCache) _fontsCache = loadFonts();
  return _fontsCache;
}
