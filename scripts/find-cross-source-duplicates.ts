// =============================================================================
// scripts/find-cross-source-duplicates.ts
// =============================================================================
// Busca carreras duplicadas entre DISTINTAS fuentes y propone un merge.
//
// REGLAS CONSERVADORAS (para no borrar carreras distintas por error):
//   - Solo se considera duplicado si las carreras son de FUENTES DISTINTAS
//     (RFEA vs FEDME vs ITRA vs Sportmaniacs vs Runedia vs Manual)
//   - Si son de la misma fuente y mismo nombre+fecha, es un duplicado por
//     re-ingest — eso ya lo arregla fix-duplicate-slugs.ts
//   - officialUrl solo cuenta si es una URL específica (no homepage genérica)
//   - El nombre debe ser normalizado idéntico
//
// Estrategia de merge:
//   - Primary = la que tiene más campos rellenos
//   - Para cada campo, se queda con el primero no-vacío (primary优先)
//   - Para arrays (hashtags, galleryUrls), concatenan y dedupe
//   - Las carreras secundarias se borran, pero sus IDs se guardan en
//     mergedFromIds del primary para auditoría
//
// Uso:
//   npx tsx --env-file=.env.local scripts/find-cross-source-duplicates.ts
//   npx tsx --env-file=.env.local scripts/find-cross-source-duplicates.ts --execute
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const EXECUTE = process.argv.includes("--execute");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl);

const SOURCE_PRIORITY = ["RFEA", "FEDME", "ITRA", "Sportmaniacs", "Runedia", "Manual"];

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isHomepageUrl(url: string | undefined): boolean {
  if (!url) return true;
  try {
    const u = new URL(url);
    // Homepage = sin path o solo "/"
    if (u.pathname === "" || u.pathname === "/") return true;
    // Raíces típicas que los scrapers asignan por defecto
    const homePatterns = [
      /^https?:\/\/(www\.)?fedme\.es\/?$/i,
      /^https?:\/\/(www\.)?rfea\.es\/?$/i,
      /^https?:\/\/(www\.)?sportmaniacs\.com\/?$/i,
      /^https?:\/\/(www\.)?runedia\.es\/?$/i,
      /^https?:\/\/itra\.run\/?$/i,
    ];
    return homePatterns.some((re) => re.test(url));
  } catch {
    return true;
  }
}

function countFields(r: any): number {
  let n = 0;
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith("_")) continue;
    if (k === "slug" || k === "scraperAdapter") continue;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    n++;
  }
  return n;
}

function pickPrimary(races: any[]): any {
  return [...races].sort((a, b) => {
    const fieldsDiff = countFields(b) - countFields(a);
    if (fieldsDiff !== 0) return fieldsDiff;
    const aIdx = SOURCE_PRIORITY.indexOf(a.scraperAdapter ?? "");
    const bIdx = SOURCE_PRIORITY.indexOf(b.scraperAdapter ?? "");
    const aP = aIdx === -1 ? 999 : aIdx;
    const bP = bIdx === -1 ? 999 : bIdx;
    if (aP !== bP) return aP - bP;
    return (a._creationTime ?? 0) - (b._creationTime ?? 0);
  })[0];
}

/** Detecta grupos de duplicados cross-source (mismas fuentes ≠ ) */
function detectGroups(races: any[]): Array<{
  key: string;
  reason: string;
  races: any[];
}> {
  const candidates: Array<{ key: string; reason: string; races: any[] }> = [];

  // CRITERIO 1: mismo nombre + misma fecha + misma localidad
  const byNdl = new Map<string, any[]>();
  for (const r of races) {
    if (!r.startDate || !r.locality || !r.name) continue;
    const key = `${normalizeName(r.name)}|${r.startDate}|${normalizeName(r.locality)}`;
    if (!byNdl.has(key)) byNdl.set(key, []);
    byNdl.get(key)!.push(r);
  }
  for (const [key, list] of byNdl.entries()) {
    if (list.length < 2) continue;
    // FILTRO CLAVE: solo si hay al menos 2 fuentes DISTINTAS
    const sources = new Set(list.map((r) => r.scraperAdapter ?? "manual"));
    if (sources.size < 2) continue;
    candidates.push({ key, reason: "Mismo nombre + fecha + localidad (cross-source)", races: list });
  }

  // CRITERIO 2: mismo nombre + misma fecha (sin localidad)
  const byNd = new Map<string, any[]>();
  for (const r of races) {
    if (!r.startDate || !r.name) continue;
    const key = `${normalizeName(r.name)}|${r.startDate}`;
    if (!byNd.has(key)) byNd.set(key, []);
    byNd.get(key)!.push(r);
  }
  for (const [key, list] of byNd.entries()) {
    if (list.length < 2) continue;
    const sources = new Set(list.map((r) => r.scraperAdapter ?? "manual"));
    if (sources.size < 2) continue;
    // Evitar duplicar lo que ya detectó el criterio 1
    if (candidates.some((c) => c.races.some((x) => list.some((y) => y._id === x._id)))) continue;
    candidates.push({ key, reason: "Mismo nombre + fecha (cross-source, sin localidad)", races: list });
  }

  // CRITERIO 3: mismo officialUrl ESPECÍFICO (no homepage)
  const byUrl = new Map<string, any[]>();
  for (const r of races) {
    if (!r.officialUrl || isHomepageUrl(r.officialUrl)) continue;
    const key = r.officialUrl;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key)!.push(r);
  }
  for (const [key, list] of byUrl.entries()) {
    if (list.length < 2) continue;
    const sources = new Set(list.map((r) => r.scraperAdapter ?? "manual"));
    if (sources.size < 2) continue;
    if (candidates.some((c) => c.races.some((x) => list.some((y) => y._id === x._id)))) continue;
    candidates.push({ key, reason: "Mismo officialUrl (específico, cross-source)", races: list });
  }

  return candidates;
}

function buildMerge(primary: any, others: any[]): any {
  const patch: any = {};
  const all = [primary, ...others];

  for (const r of all) {
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith("_")) continue;
      if (k === "slug" || k === "name" || k === "scraperAdapter" || k === "ingestedAt" || k === "extractedFromUrl" || k === "extractedAt" || k === "extractionConfidence") continue;
      if (k === "dataSourceId") {
        // Guardar TODOS los dataSourceId únicos en pendingExtraSourceIds
        // (luego se mueven a additionalDataSourceIds, sin el del primary)
        if (v) {
          if (!patch.pendingExtraSourceIds) patch.pendingExtraSourceIds = [];
          if (!patch.pendingExtraSourceIds.includes(v)) patch.pendingExtraSourceIds.push(v);
        }
        continue;
      }
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      if (patch[k] === undefined) patch[k] = v;
    }
  }

  // Arrays: concatenar y dedupe
  for (const arrayKey of ["hashtags", "galleryUrls", "raceFormats", "aidStations"]) {
    const allItems: any[] = [];
    for (const r of all) {
      if (Array.isArray(r[arrayKey])) allItems.push(...r[arrayKey]);
    }
    if (allItems.length > 0) {
      // Dedupe simple por contenido JSON
      const seen = new Set<string>();
      patch[arrayKey] = allItems.filter((item) => {
        const k = JSON.stringify(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  }

  // Merge metadata
  patch.mergedFromIds = others.map((r) => r._id);
  patch.mergedAt = Date.now();
  if (patch.pendingExtraSourceIds && patch.pendingExtraSourceIds.length > 0) {
    const primaryDs = primary.dataSourceId;
    patch.additionalDataSourceIds = patch.pendingExtraSourceIds.filter((id: string) => id !== primaryDs);
  }
  // Limpiar campos temporales que no están en el schema
  delete patch.pendingExtraSourceIds;

  return patch;
}

async function main() {
  console.log("=".repeat(70));
  console.log(`Búsqueda de duplicados CROSS-SOURCE (${EXECUTE ? "EJECUTANDO" : "DRY RUN"})`);
  console.log("=".repeat(70));
  console.log("Criterios:");
  console.log("  1. Mismo nombre + fecha + localidad, de fuentes DISTINTAS");
  console.log("  2. Mismo nombre + fecha (sin localidad), de fuentes DISTINTAS");
  console.log("  3. Mismo officialUrl específico (no homepage), de fuentes DISTINTAS");
  console.log("  ⚠️  Si 2 carreras son de la MISMA fuente y mismo nombre, es un duplicado");
  console.log("     de re-ingest — eso lo arregla fix-duplicate-slugs.ts, no este script.");

  const races: any[] = await client.query(api.races.systemListAllDetailed, {} as any);
  console.log(`\nTotal carreras en BBDD: ${races.length}`);

  const groups = detectGroups(races);
  console.log(`Encontrados ${groups.length} grupos de duplicados cross-source\n`);

  if (groups.length === 0) {
    console.log("✅ No hay duplicados cross-source");
    return;
  }

  let totalMerged = 0;
  let totalDeleted = 0;
  let totalFieldsAdded = 0;

  for (const group of groups) {
    const primary = pickPrimary(group.races);
    const others = group.races.filter((r: any) => r._id !== primary._id);
    console.log(`\n📍 ${group.reason}`);
    console.log(`   Primary: ${primary._id}`);
    console.log(`     "${primary.name}" — ${primary.scraperAdapter ?? "manual"} — ${countFields(primary)} campos — ${primary.startDate ?? "?"} — ${primary.locality ?? "?"}`);
    for (const o of others) {
      console.log(`   Otro:    ${o._id}`);
      console.log(`     "${o.name}" — ${o.scraperAdapter ?? "manual"} — ${countFields(o)} campos — ${o.startDate ?? "?"} — ${o.locality ?? "?"}`);
    }

    if (EXECUTE) {
      const patch = buildMerge(primary, others);
      const fieldsAdded = Object.keys(patch).filter((k) => !k.startsWith("_")).length;
      console.log(`   → Aplicando ${fieldsAdded} campos al primary`);
      try {
        await client.mutation(api.races.systemUpdate, { id: primary._id, patch });
        totalFieldsAdded += fieldsAdded;

        for (const o of others) {
          await client.mutation(api.races.systemDelete, { id: o._id } as any);
          totalDeleted++;
        }
        totalMerged++;
        console.log(`   ✅ Merge + delete OK`);
      } catch (e: any) {
        console.error(`   ❌ Error: ${e?.message ?? e}`);
      }
    } else {
      console.log(`   [dry] Se haría merge de ${others.length} carreras en primary`);
      totalMerged++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`Grupos:                    ${groups.length}`);
  console.log(`Carreras que se eliminan:  ${totalDeleted || "(0 en dry-run)"}`);
  console.log(`Campos añadidos al primary: ${totalFieldsAdded}`);
  if (!EXECUTE) console.log(`\n(DRY RUN — añade --execute para ejecutar)`);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
