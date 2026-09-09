// =============================================================================
// mi-dorsal — Preview script (v2): HTML estático + Playwright screenshot
// =============================================================================
// Renderiza el share card como HTML/CSS estático (sin satori) con
// @import de Google Fonts. Playwright carga el HTML, espera las fonts,
// y toma screenshot.
//
// Output:
//   - diploma-preview-assets/example-share-card.html
//   - diploma-preview-assets/example-share-card.png
// =============================================================================

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const props = {
  runnerName: "Juan Manuel Vera Bernabeu",
  raceName: "XX Media Maratón Ciudad de Alicante",
  raceDate: "25 de octubre de 2025",
  distanceLabel: "21K",
  timeFormatted: "1:59:25",
  dorsalNumber: "2501",
  positionOverall: 3521,
  totalRunners: 8124,
  positionCategory: 949,
  paceFormatted: "5:40",
  isPersonalRecord: true,
  previousRecordFormatted: "2:00:48",
  prDeltaSeconds: 83,
  appUrl: "https://mi-dorsal.com",
};

const domain = props.appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Share card — mi-dorsal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #fafaf9;
    color: #1c1917;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 1200px;
    height: 630px;
    display: flex;
    flex-direction: row;
    background: #fafaf9;
    position: relative;
  }
  .col-left {
    width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    background: #fafaf9;
  }
  .dorsal-card {
    width: 320px;
    height: 440px;
    background: #dc2626;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 32px;
  }
  .dorsal-label {
    color: white;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 8px;
    margin-bottom: 16px;
  }
  .dorsal-number {
    color: white;
    font-size: 180px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: -8px;
    line-height: 1;
  }
  .dorsal-pill {
    position: absolute;
    bottom: -24px;
    right: -24px;
    width: 112px;
    height: 112px;
    border-radius: 56px;
    background: white;
    border: 4px solid #dc2626;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dorsal-pill-text {
    font-size: 26px;
    font-weight: 700;
    color: #0a0a0a;
    font-family: 'JetBrains Mono', monospace;
  }
  .col-right {
    width: 720px;
    display: flex;
    flex-direction: column;
    padding: 48px 56px 40px 32px;
    background: #fafaf9;
    position: relative;
  }
  .brand-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .brand-left {
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .brand-mark {
    width: 32px;
    height: 32px;
    background: #dc2626;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
  }
  .brand-mark-text {
    color: white;
    font-size: 20px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1;
  }
  .brand-name {
    font-size: 22px;
    font-weight: 700;
    color: #0a0a0a;
    letter-spacing: -0.3px;
  }
  .brand-subtitle {
    font-size: 13px;
    color: #78716c;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .pr-badge {
    display: flex;
    align-self: flex-start;
    background: #dcfce7;
    border: 2px solid #16a34a;
    border-radius: 999px;
    padding: 8px 18px;
    margin-bottom: 16px;
  }
  .pr-badge-text {
    font-size: 14px;
    font-weight: 700;
    color: #15803d;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .race-name {
    font-size: 28px;
    font-weight: 700;
    color: #0a0a0a;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .race-date {
    font-size: 16px;
    color: #78716c;
    margin-bottom: 24px;
  }
  .time-hero {
    font-size: 104px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: #16a34a;
    letter-spacing: -4px;
    line-height: 1;
    margin-bottom: 8px;
  }
  .time-label {
    font-size: 13px;
    color: #78716c;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 20px;
  }
  .stats {
    display: flex;
    flex-direction: row;
    gap: 12px;
    margin-bottom: auto;
  }
  .stat {
    flex: 1;
    background: white;
    border: 1px solid #e7e5e4;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
  }
  .stat-label {
    font-size: 11px;
    color: #78716c;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .stat-value {
    font-size: 22px;
    font-weight: 700;
    color: #0a0a0a;
  }
  .stat-value-mono {
    font-size: 22px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: #0a0a0a;
    display: flex;
    align-items: baseline;
  }
  .stat-value-sub {
    font-size: 13px;
    color: #78716c;
    margin-left: 4px;
  }
  .footer {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e7e5e4;
  }
  .footer-tagline {
    font-size: 13px;
    color: #78716c;
    font-style: italic;
  }
  .footer-domain {
    font-size: 13px;
    color: #a8a29e;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="col-left">
      <div class="dorsal-card">
        <div class="dorsal-label">DORSAL</div>
        <div class="dorsal-number">${props.dorsalNumber}</div>
        <div class="dorsal-pill">
          <div class="dorsal-pill-text">${props.distanceLabel.toUpperCase()}</div>
        </div>
      </div>
    </div>
    <div class="col-right">
      <div class="brand-header">
        <div class="brand-left">
          <div class="brand-mark">
            <div class="brand-mark-text">m</div>
          </div>
          <div class="brand-name">mi-dorsal</div>
        </div>
        <div class="brand-subtitle">Resultado oficial</div>
      </div>
      ${props.isPersonalRecord ? `<div class="pr-badge"><div class="pr-badge-text">Nuevo PR en ${props.distanceLabel}</div></div>` : ""}
      <div class="race-name">${props.raceName}</div>
      <div class="race-date">${props.raceDate}</div>
      <div class="time-hero">${props.timeFormatted}</div>
      <div class="time-label">Tu tiempo oficial</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Pos. general</div>
          <div class="stat-value">${props.positionOverall.toLocaleString("es-ES")} / ${props.totalRunners.toLocaleString("es-ES")}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Pos. categoría</div>
          <div class="stat-value">${props.positionCategory}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Pace medio</div>
          <div class="stat-value-mono">${props.paceFormatted}<div class="stat-value-sub">/km</div></div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-tagline">El hilo que te une a tu dorsal</div>
        <div class="footer-domain">${domain}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function main() {
  const outDir = join(process.cwd(), "diploma-preview-assets");
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, "example-share-card.html");
  writeFileSync(htmlPath, html);
  console.log(`[preview] HTML guardado: ${htmlPath}`);

  console.log("[preview] Screenshot con Playwright...");
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
    await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
    // Esperar a que las fonts carguen
    await page.evaluate(() => document.fonts.ready);
    const pngPath = join(outDir, "example-share-card.png");
    await page.screenshot({ path: pngPath, type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await browser.close();
    console.log(`[preview] ✓ Screenshot: ${pngPath}`);
  } catch (e) {
    console.log(`[preview] ⚠ Playwright falló: ${e instanceof Error ? e.message : e}`);
  }
}

main().catch((e) => {
  console.error("[preview] Error:", e);
  process.exit(1);
});
