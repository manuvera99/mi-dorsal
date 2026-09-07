// =============================================================================
// scripts/find-dup-by-date-distance.ts
// =============================================================================
// Detecta duplicados probables basándose en seÑales ESTRUCTURALES (no de nombre),
// para los casos en los que el nombre es demasiado distinto o incompleto
// (típico de Runedia, que mete registros esqueléticos).
//
// Criterio: dos carreras son "candidatas a duplicado" si:
//   - Mismo startDate (YYYY-MM-DD exacto)
//   - Misma province
//   - Mismo distanceKm (con tolerancia de ±0.1 km para redondeos)
//   - locality igual O una contiene a la otra
//
// Esto es MUY más conservador que la similitud de nombre:
//   - Captura "Media Maratón Albacete" (runedia) vs "29º Medio Maratón Internacional
//     Ciudad de Albacete" (correbirras) — Runedia es muy esquelético
//   - Captura duplicados cross-source con nombres radicalmente distintos
//   - No captura modalidades distintas (5K vs 10K vs 21K) porque la distancia difiere
//   - No captura circuitos regionales en distintas ciudades (locality difiere)
//
// Uso:
//   npx tsx --env-file=.env.local scripts/find-dup-by-date-distance.ts
//   npx tsx --env-file=.env.local scripts/find-dup-by-date-distance.ts --tolerance=0.5
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const args = process.argv.slice(2);
const TOLERANCE_KM = Number(args.find((a) => a.startsWith("--tolerance="))?.split("=")[1]) || 0.1;

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl);

interface Race {
  _id: string;
  name: string;
  slug: string;
  locality: string | null;
  province: string | null;
  startDate: string | null;
  startTime: string | null;
  distanceKm: number;
  scraperAdapter: string | null;
  officialUrl: string | null;
}

function norm(s: string | null): string {
  if (!s) return "";
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function localitiesMatch(a: string | null, b: string | null): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return true; // si una falta, no descartar
  return na === nb || na.includes(nb) || nb.includes(na);
}

function countFields(r: any): number {
  let n = 0;
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith("_") || k === "slug" || k === "scraperAdapter") continue;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    n++;
  }
  return n;
}

async function main() {
  console.log("=".repeat(78));
  console.log(`Duplicados por ESTRUCTURA (date+province+distance) — tolerancia ${TOLERANCE_KM} km`);
  console.log("=".repeat(78));
  console.log("Criterios:");
  console.log("  - Mismo startDate");
  console.log("  - Misma province");
  console.log("  - Mismo distanceKm (tolerancia ±" + TOLERANCE_KM + " km)");
  console.log("  - locality compatible (igual o una contiene a la otra)");
  console.log("");

  const raw: any[] = await client.query(api.races.systemListAllDetailed, {} as any);
  console.log("Total carreras:", raw.length);

  const races: Race[] = raw.map((r) => ({
    _id: r._id,
    name: r.name,
    slug: r.slug,
    locality: r.locality ?? null,
    province: r.province ?? null,
    startDate: r.startDate ?? null,
    startTime: r.startTime ?? null,
    distanceKm: r.distanceKm,
    scraperAdapter: r.scraperAdapter ?? null,
    officialUrl: r.officialUrl ?? null,
  }));

  // Bucket por (date, province, distance rounded to 0.5km)
  const buckets = new Map<string, Race[]>();
  for (const r of races) {
    if (!r.startDate || !r.province) continue;
    const distBucket = Math.round(r.distanceKm * 2) / 2; // bucketing a 0.5 km
    const key = `${r.startDate}|${r.province}|${distBucket}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }

  // Buscar pares con locality compatible
  const candidates: Array<{ a: Race; b: Race; reason: string }> = [];
  for (const [key, list] of buckets.entries()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // Filtro de localidad
        if (!localitiesMatch(a.locality, b.locality)) continue;
        // Filtro de distancia exacta (no solo bucketed)
        if (Math.abs(a.distanceKm - b.distanceKm) > TOLERANCE_KM) continue;
        candidates.push({
          a,
          b,
          reason: `${key} (${a.distanceKm} vs ${b.distanceKm} km, ${a.locality ?? "?"} vs ${b.locality ?? "?"})`,
        });
      }
    }
  }

  candidates.sort((x, y) => {
    // Agrupar por date+province
    const xKey = `${x.a.startDate}|${x.a.province}`;
    const yKey = `${y.a.startDate}|${y.a.province}`;
    return xKey.localeCompare(yKey);
  });

  console.log(`\nPares candidatos: ${candidates.length}\n`);

  if (candidates.length === 0) {
    console.log("✅ No hay candidatos");
    return;
  }

  let lastKey = "";
  for (const { a, b, reason } of candidates) {
    const key = `${a.startDate}|${a.province}`;
    if (key !== lastKey) {
      console.log(`\n── ${key} ──`);
      lastKey = key;
    }
    const sameSource = a.scraperAdapter === b.scraperAdapter;
    const fieldsA = countFields((await client.query(api.races.get, { id: a._id as any })) ?? {});
    const fieldsB = countFields((await client.query(api.races.get, { id: b._id as any })) ?? {});
    console.log(`  ${sameSource ? "SAME" : "CROSS"}-source | ${a.distanceKm}km vs ${b.distanceKm}km`);
    console.log(`    A: [${fieldsA}campos, ${a.scraperAdapter ?? "manual"}] "${a.name}"`);
    console.log(`       ${a._id}  ${a.locality ?? "?"}`);
    console.log(`    B: [${fieldsB}campos, ${b.scraperAdapter ?? "manual"}] "${b.name}"`);
    console.log(`       ${b._id}  ${b.locality ?? "?"}`);
  }

  // Resumen
  const sameSrc = candidates.filter((c) => c.a.scraperAdapter === c.b.scraperAdapter).length;
  const crossSrc = candidates.length - sameSrc;
  console.log("\n" + "=".repeat(78));
  console.log("RESUMEN");
  console.log("=".repeat(78));
  console.log(`Pares candidatos:        ${candidates.length}`);
  console.log(`  same-source:           ${sameSrc}`);
  console.log(`  cross-source:          ${crossSrc}  ← candidatos a MERGE`);
  console.log(`Carreras únicas:        ${new Set(candidates.flatMap((c) => [c.a._id, c.b._id])).size}`);
  console.log("");
  console.log("Para los cross-source: revisar manualmente y, si confirma duplicado,");
  console.log("usar `npx tsx scripts/find-cross-source-duplicates.ts --execute` (con");
  console.log("el source a source correspondiente) o crear un merge manual via admin.");
}

main().catch((e) => { console.error(e); process.exit(1); });
