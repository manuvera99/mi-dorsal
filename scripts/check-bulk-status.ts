// =============================================================================
// scripts/check-bulk-status.ts
// =============================================================================
// Mide cuántas carreras tienen cada campo "rico" poblado.
// 18 métricas: incluye los básicos que SÍ estamos rellenando (organizer, social,
// address, lat/lng) para que el reporte refleje progreso real.
//
// Uso: npx tsx --env-file=.env.local scripts/check-bulk-status.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

interface Row {
  label: string;
  count: (r: any) => boolean;
}

const ROWS: Row[] = [
  { label: "Con extractedAt (al menos 1 pasada IA)", count: (r) => !!r.extractedAt },
  { label: "  └ con extractionConfidence=high/medium", count: (r) => r.extractionConfidence === "high" || r.extractionConfidence === "medium" },
  { label: "Con longDescription (1+ parrafos)", count: (r) => !!r.longDescription },
  { label: "Con altimetryData (per-km)", count: (r) => Array.isArray(r.altimetryData) && r.altimetryData.length > 0 },
  { label: "Con raceFormats (modalidades)", count: (r) => Array.isArray(r.raceFormats) && r.raceFormats.length > 0 },
  { label: "Con aidStations (avituallamientos)", count: (r) => Array.isArray(r.aidStations) && r.aidStations.length > 0 },
  { label: "Con priceTiers (tramos de precio)", count: (r) => Array.isArray(r.priceTiers) && r.priceTiers.length > 0 },
  { label: "Con categories (categorias edad/genero)", count: (r) => Array.isArray(r.categories) && r.categories.length > 0 },
  { label: "Con services (algun servicio marcado)", count: (r) => r.services && Object.keys(r.services).length > 0 },
  { label: "Con dorsalPickup (lugar u horario)", count: (r) => !!r.dorsalPickupLocation || !!r.dorsalPickupHours },
  { label: "Con organizer (quien organiza)", count: (r) => !!r.organizer },
  { label: "Con organizerUrl", count: (r) => !!r.organizerUrl },
  { label: "Con address (direccion de salida)", count: (r) => !!r.address },
  { label: "Con latitude/longitude (en mapa)", count: (r) => typeof r.latitude === "number" && typeof r.longitude === "number" },
  { label: "Con startTime (hora de salida)", count: (r) => !!r.startTime },
  { label: "Con socialInstagram", count: (r) => !!r.socialInstagram },
  { label: "Con socialFacebook", count: (r) => !!r.socialFacebook },
  { label: "Con imageUrl (cartel)", count: (r) => !!r.imageUrl },
];

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, { onlyWithOfficialUrl: true });
  const all = await c.query(api.races.systemListAll, {});
  const total = all.length;

  console.log("=".repeat(72));
  console.log(`Catalogo total: ${total} carreras (${r.length} con officialUrl procesables por IA)`);
  console.log("=".repeat(72));

  for (const row of ROWS) {
    const count = r.filter(row.count).length;
    const pct = r.length > 0 ? ((count / r.length) * 100).toFixed(1) : "0.0";
    const bar = "#".repeat(Math.round(parseFloat(pct) / 4));
    const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
    console.log(`${pad(row.label, 54)} ${pad(count + "/" + r.length, 10)} ${pad(pct + "%", 7)} ${bar}`);
  }

  const notExtracted = r.filter((x: any) => !x.extractedAt);
  if (notExtracted.length > 0) {
    console.log("");
    console.log("-".repeat(72));
    console.log(`Pendientes de extraer: ${notExtracted.length} carreras`);
    const bySource: Record<string, number> = {};
    for (const x of notExtracted as any[]) {
      const src = x.scraperAdapter ?? "manual/desconocido";
      bySource[src] = (bySource[src] ?? 0) + 1;
    }
    Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .forEach(([s, n]) => console.log(`  ${s.padEnd(20)} ${n}`));
  }

  const extracted = r.filter((x: any) => x.extractedAt);
  if (extracted.length > 0) {
    console.log("");
    console.log("-".repeat(72));
    console.log(`Extraidos: ${extracted.length} carreras`);
    const byConf: Record<string, number> = {};
    for (const x of extracted as any[]) {
      const c = x.extractionConfidence ?? "unknown";
      byConf[c] = (byConf[c] ?? 0) + 1;
    }
    Object.entries(byConf)
      .sort((a, b) => b[1] - a[1])
      .forEach(([c, n]) => console.log(`  confidence=${c.padEnd(8)} ${n}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
