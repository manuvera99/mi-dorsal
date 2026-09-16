// =============================================================================
// mi-dorsal — Render del carrusel "¿Qué puedes hacer con mi-dorsal?"
// =============================================================================
// Monta texto con jerarquía real (chip + titular corto + línea de apoyo) sobre
// las 6 fotos limpias generadas con Higgsfield, vía HTML/CSS + Playwright
// (mismo patrón que scripts/example-share-card-html.ts). Evita el texto
// "quemado" por la IA — control total de tipografía de marca (Sora + Inter).
//
// Output: marketing-assets/carrusel-que-ofrece-la-app/final/0N-*.png
// =============================================================================

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const BASE_DIR = join(process.cwd(), "marketing-assets", "carrusel-que-ofrece-la-app");
const OUT_DIR = join(BASE_DIR, "final");
const LOGO_PATH = join(process.cwd(), "public", "brand-assets", "isotipo-mono-black.png");

type Slide = {
  file: string;
  chip: string;
  chipColor: string;
  headline: string;
  support: string;
  align: "top" | "bottom" | "center";
  scrim: "top" | "bottom" | "full-bottom";
  headlineSize?: number;
  supportSize?: number;
};

const slides: Slide[] = [
  {
    file: "01-portada.png",
    chip: "MI-DORSAL",
    chipColor: "#dc2626",
    headline: "Todo lo que hace\nmi-dorsal por ti.",
    support: "Tu temporada, resuelta.",
    align: "top",
    scrim: "top",
  },
  {
    file: "02-catalogo-calendario.png",
    chip: "GRATIS",
    chipColor: "#16a34a",
    headline: "Tu temporada,\nen un solo sitio.",
    support: "Catálogo y calendario sin límite de carreras.",
    align: "top",
    scrim: "top",
  },
  {
    file: "03-resultado-diploma.png",
    chip: "GRATIS",
    chipColor: "#16a34a",
    headline: "Tu resultado\noficial, al buzón.",
    support: "Diploma PDF automático al cruzar la meta.",
    align: "top",
    scrim: "top",
  },
  {
    file: "04-strava-tiempo-real.png",
    chip: "PRO",
    chipColor: "#dc2626",
    headline: "Strava, conectado\nde verdad.",
    support: "Sincronización en tiempo real, sin exportar nada.",
    align: "top",
    scrim: "top",
  },
  {
    file: "05-encuentra-tus-fotos-ia.png",
    chip: "PRO · NUEVO",
    chipColor: "#dc2626",
    headline: "Encuentra tus\nfotos con IA.",
    support: "Sube tu selfie. Te buscamos por cara y dorsal.",
    align: "bottom",
    scrim: "bottom",
    headlineSize: 148,
    supportSize: 58,
  },
  {
    file: "06-cta-final.png",
    chip: "PRUÉBALO GRATIS",
    chipColor: "#dc2626",
    headline: "Tu dorsal,\nde principio a fin.",
    support: "Pro desde 2,99 €/mes · 24,99 €/año · 14 días gratis",
    align: "center",
    scrim: "full-bottom",
  },
];

function scrimCss(kind: Slide["scrim"]): string {
  // Stops concentrados en la franja donde vive el texto (~30-35% del lienzo),
  // 100% transparente en el resto — un gradiente "largo" sobre una foto con
  // mucho blanco (ej. slide de portada) vuelve gris turbia toda la imagen.
  if (kind === "top") {
    return "background: linear-gradient(to bottom, rgba(10,10,10,0.62) 0%, rgba(10,10,10,0.30) 24%, rgba(10,10,10,0) 34%);";
  }
  if (kind === "bottom") {
    return "background: linear-gradient(to top, rgba(10,10,10,0.68) 0%, rgba(10,10,10,0.32) 26%, rgba(10,10,10,0) 36%);";
  }
  return "background: linear-gradient(rgba(10,10,10,0.72) 0%, rgba(10,10,10,0.82) 50%, rgba(10,10,10,0.72) 100%);";
}

function alignCss(align: Slide["align"]): string {
  if (align === "top") return "justify-content: flex-start; padding-top: 96px;";
  if (align === "bottom") return "justify-content: flex-end; padding-bottom: 110px;";
  return "justify-content: center;";
}

function buildHtml(slide: Slide, imagePath: string, logoPath: string): string {
  const headlineLines = slide.headline
    .split("\n")
    .map((l) => `<span class="line">${l}</span>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Slide — mi-dorsal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 2048px; height: 2048px; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 2048px;
    height: 2048px;
    object-fit: cover;
  }
  .scrim {
    position: absolute;
    inset: 0;
    ${scrimCss(slide.scrim)}
  }
  .content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    ${alignCss(slide.align)}
    padding-left: 96px;
    padding-right: 96px;
  }
  .chip {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    background: ${slide.chipColor};
    color: #fafaf9;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    font-size: 30px;
    letter-spacing: 3px;
    padding: 14px 32px;
    border-radius: 999px;
    margin-bottom: 40px;
  }
  .headline {
    font-family: 'Sora', sans-serif;
    font-weight: 800;
    font-size: 128px;
    line-height: 1.05;
    color: #fafaf9;
    letter-spacing: -2px;
    margin-bottom: 32px;
  }
  .headline .line {
    display: block;
  }
  .support {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 50px;
    line-height: 1.4;
    color: rgba(250,250,249,0.95);
    max-width: 1700px;
  }
  .center .chip { align-self: center; }
  .center .headline { text-align: center; }
  .center .support { text-align: center; margin-left: auto; margin-right: auto; }
  .brand-badge {
    position: absolute;
    top: 64px;
    right: 64px;
    width: 108px;
    height: 108px;
    background: #fafaf9;
    border-radius: 28px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.28);
    padding: 18px;
  }
  .brand-badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
</head>
<body>
  <img class="bg" src="${imagePath}" />
  <div class="scrim"></div>
  <div class="brand-badge"><img src="${logoPath}" /></div>
  <div class="content ${slide.align === "center" ? "center" : ""}">
    <div class="chip">${slide.chip}</div>
    <div class="headline"${slide.headlineSize ? ` style="font-size: ${slide.headlineSize}px;"` : ""}>${headlineLines}</div>
    <div class="support"${slide.supportSize ? ` style="font-size: ${slide.supportSize}px;"` : ""}>${slide.support}</div>
  </div>
</body>
</html>`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const imgAbsPath = join(BASE_DIR, slide.file);
    const imageUrl = pathToFileURL(imgAbsPath).href;
    const logoUrl = pathToFileURL(LOGO_PATH).href;
    const html = buildHtml(slide, imageUrl, logoUrl);

    const htmlPath = join(OUT_DIR, `${String(i + 1).padStart(2, "0")}-source.html`);
    writeFileSync(htmlPath, html);

    const page = await browser.newPage({ viewport: { width: 2048, height: 2048 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const outName = slide.file.replace(".png", "-final.png");
    const pngPath = join(OUT_DIR, outName);
    await page.screenshot({ path: pngPath, type: "png", clip: { x: 0, y: 0, width: 2048, height: 2048 } });
    await page.close();
    console.log(`[carrusel] ✓ ${outName}`);
  }

  await browser.close();
  console.log(`[carrusel] Listo en ${OUT_DIR}`);
}

main().catch((e) => {
  console.error("[carrusel] Error:", e);
  process.exit(1);
});
