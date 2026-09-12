// =============================================================================
// scripts/fix-cross-source-duplicates.ts
// =============================================================================
// Limpia el backlog de duplicados cross-source detectados hoy en
// /admin/duplicates (exact + structural + fuzzy), migrando referencias de
// usuario a la carrera conservada antes de borrar cada duplicado.
//
// Por qué existe: hasta el 2026-09-12, systemUpsert no reconocía carreras
// ya existentes cruzando fuentes (ver
// docs/superpowers/specs/2026-09-12-prevenir-duplicados-ingest-design.md),
// así que cada noche de ingesta pudo haber creado duplicados que hoy están
// acumulados en la base de datos real. Este script es un ONE-OFF para
// limpiar ese backlog una vez — el fix de systemUpsert evita que se sigan
// creando nuevos a partir de ahora.
//
// IMPORTANTE: no hay entorno de sandbox — este script apunta a la BD real
// de producción/dev (mismo deployment). SIEMPRE correr primero sin flags
// (dry-run) y revisar el log completo antes de pasar --execute.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-cross-source-duplicates.ts
//   npx tsx --env-file=.env.local scripts/fix-cross-source-duplicates.ts --execute
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  normalizeName,
  tokenize,
  jaccard,
  localitiesCompatible,
} from "../convex/duplicateMatching";

const EXECUTE = process.argv.includes("--execute");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl);

type RaceDoc = {
  _id: string;
  _creationTime: number;
  name: string;
  startDate?: string;
  province?: string;
  locality?: string;
  distanceKm: number;
  scraperAdapter?: string;
  [key: string]: unknown;
};

type Group = {
  key: string;
  reasonType: "exact" | "structural" | "fuzzy";
  races: RaceDoc[];
};

function countFields(r: RaceDoc): number {
  let n = 0;
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith("_") || k === "slug" || k === "scraperAdapter" || k === "extractedAt") continue;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    n++;
  }
  return n;
}

/** Mismo algoritmo de agrupación que adminFindDuplicates (convex/races.ts),
 *  pero corriendo en el script con las funciones puras importadas, porque
 *  adminFindDuplicates exige auth admin que este script no tiene. */
function findDuplicateGroups(all: RaceDoc[], similarityThreshold = 0.75): Group[] {
  const groups = new Map<string, Group>();
  const addGroup = (races: RaceDoc[], reasonType: Group["reasonType"]) => {
    if (races.length < 2) return;
    const ids = races.map((r) => r._id).sort();
    const key = ids.join("|");
    const existing = groups.get(key);
    if (existing) {
      const order = { exact: 0, structural: 1, fuzzy: 2 } as const;
      if (order[reasonType] < order[existing.reasonType]) {
        groups.set(key, { key, reasonType, races });
      }
      return;
    }
    groups.set(key, { key, reasonType, races });
  };

  // Detector 1: exact
  const byExact = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate) continue;
    const norm = normalizeName(r.name);
    if (!norm) continue;
    const k = `${r.scraperAdapter ?? "manual"}|${norm}|${r.startDate}`;
    if (!byExact.has(k)) byExact.set(k, []);
    byExact.get(k)!.push(r);
  }
  for (const [, list] of byExact) {
    if (list.length >= 2) addGroup(list, "exact");
  }

  // Detector 2: structural
  const byStructural = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate || !r.province) continue;
    const distBucket = Math.round(r.distanceKm * 2) / 2;
    const k = `${r.startDate}|${r.province}|${distBucket}`;
    if (!byStructural.has(k)) byStructural.set(k, []);
    byStructural.get(k)!.push(r);
  }
  for (const [, list] of byStructural) {
    if (list.length < 2) continue;
    const sources = new Set(list.map((r) => r.scraperAdapter ?? "manual"));
    if (sources.size < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!localitiesCompatible(a.locality, b.locality)) continue;
        if (Math.abs(a.distanceKm - b.distanceKm) > 0.1) continue;
        addGroup([a, b], "structural");
      }
    }
  }

  // Detector 3: fuzzy
  const byFuzzyBucket = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate) continue;
    const prov = r.province ?? r.locality ?? "?";
    const k = `${r.startDate}|${prov}`;
    if (!byFuzzyBucket.has(k)) byFuzzyBucket.set(k, []);
    byFuzzyBucket.get(k)!.push(r);
  }
  for (const [, list] of byFuzzyBucket) {
    if (list.length < 2) continue;
    const tokensList = list.map((r) => ({ r, t: tokenize(r.name) }));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = tokensList[i];
        const b = tokensList[j];
        const sim = jaccard(a.t, b.t);
        if (sim >= similarityThreshold) addGroup([a.r, b.r], "fuzzy");
      }
    }
  }

  return Array.from(groups.values());
}

async function main() {
  console.log("=".repeat(70));
  console.log(`Fix cross-source duplicates (${EXECUTE ? "EJECUTANDO" : "DRY RUN"})`);
  console.log("=".repeat(70));
  if (!EXECUTE) {
    console.log("⚠️  DRY RUN — no se escribe nada. Revisa el log y vuelve a");
    console.log("    ejecutar con --execute cuando confirmes que está bien.");
  }

  const all = (await client.query(api.races.systemListAllDetailed, {})) as RaceDoc[];
  console.log(`\nTotal carreras en BBDD: ${all.length}`);

  const groups = findDuplicateGroups(all);
  console.log(`Encontrados ${groups.length} grupos duplicados (exact+structural+fuzzy)\n`);

  if (groups.length === 0) {
    console.log("✅ No hay duplicados pendientes");
    return;
  }

  let totalMerged = 0;
  let totalErrors = 0;

  for (const group of groups) {
    const sorted = [...group.races].sort((a, b) => countFields(b) - countFields(a));
    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`\n📍 [${group.reasonType}] "${keep.name}" (${group.races.length} carreras):`);
    console.log(`   ✓ Mantener: ${keep._id} — "${keep.name}" (${countFields(keep)} campos, ${keep.scraperAdapter ?? "manual"})`);
    for (const d of toDelete) {
      console.log(`   ${EXECUTE ? "→" : "[dry]"} Fusionar y borrar: ${d._id} — "${d.name}" (${countFields(d)} campos, ${d.scraperAdapter ?? "manual"})`);
    }

    if (EXECUTE) {
      for (const d of toDelete) {
        try {
          const res = await client.mutation(api.races.systemMergeDuplicates, {
            keepId: keep._id as any,
            deleteId: d._id as any,
          });
          console.log(`     ✅ Fusionado. Migrado: ${JSON.stringify(res.migrated)}${Object.values(res.merged).some((v) => v > 0) ? ` | Conflictos resueltos: ${JSON.stringify(res.merged)}` : ""}`);
          totalMerged++;
        } catch (e: any) {
          console.error(`     ❌ Error fusionando ${d._id}: ${e?.message ?? e}`);
          totalErrors++;
        }
      }
    } else {
      totalMerged += toDelete.length;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`Grupos:                 ${groups.length}`);
  console.log(`Carreras fusionadas:    ${totalMerged}${EXECUTE ? "" : " (0 en dry-run, esto es lo que SE HARÍA)"}`);
  if (EXECUTE && totalErrors > 0) console.log(`Errores:                ${totalErrors}`);
  if (!EXECUTE) console.log(`\n(DRY RUN — añade --execute para ejecutar de verdad)`);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
