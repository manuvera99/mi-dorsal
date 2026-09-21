// =============================================================================
// scripts/auto-merge-duplicates.ts
// =============================================================================
// Auto-fusiona duplicados detectados (exact+structural+fuzzy) automáticamente,
// SIN confirmación humana — pensado para correr cada noche justo después del
// ingest (.github/workflows/daily-ingest.yml), antes de deep-extract/geocoding.
//
// Por qué antes de deep-extract: si corriera después, una carrera duplicada
// recién creada podría ganar el "keep" solo por haber sido enriquecida esa
// misma noche, borrando una carrera vieja con historial de usuarios (myRaces,
// resultados) que en realidad tiene más valor. Corriendo justo tras el
// ingest, "más campos rellenos" compara datos que vienen directamente de los
// scrapers, sin que el enriquecimiento posterior sesgue la decisión.
//
// Diferencias respecto a scripts/fix-cross-source-duplicates.ts (que sigue
// existiendo para uso manual con dry-run/--execute, sin tocar):
//   - Sin flag --execute: este script SIEMPRE ejecuta (modo automático).
//   - Sin EXCLUDED_RACE_IDS: esa lista era un parche puntual para casos ya
//     revisados a mano (serie "The Bay" 5K/Swim/Aquathlon, "Beer Night Run
//     Miraflores"). Riesgo residual ACEPTADO explícitamente por el usuario
//     (2026-09-20): si vuelve a aparecer un patrón de eventos multideporte
//     del mismo día con nombre similar, este script SÍ los fusionará por
//     error, igual que pasó una vez con structural (carrera infantil vs
//     adultos, 14-sep-2026). Sin mitigación estructural adicional a propósito.
//   - Desempate determinista: si 2+ carreras del grupo tienen el MISMO
//     countFields, gana (se conserva) la más ANTIGUA — normalmente ya tiene
//     más probabilidad de tener referencias de usuario acumuladas, y
//     conservarla evita que systemMergeDuplicates tenga que resolver tantos
//     conflictos de migración.
//   - Persiste el resumen de la corrida vía api.dataSources.systemLogAutoMergeRun
//     para que sendIngestSummaryEmail lo incluya en el email nocturno.
//
// Uso: npx tsx scripts/auto-merge-duplicates.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { normalizeName, tokenize, jaccard, localitiesCompatible } from "../convex/duplicateMatching";

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

// Tolerancia de fecha ±1 día para structural/fuzzy (fix 2026-09-20, mismo
// que convex/races.ts systemUpsert/adminFindDuplicates). exact NO se toca.
function neighborDates(startDate: string): string[] {
  const d = new Date(startDate + "T00:00:00Z");
  const prev = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
  const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
  return [prev, startDate, next];
}

/** Mismo algoritmo que adminFindDuplicates (convex/races.ts) y
 *  scripts/fix-cross-source-duplicates.ts — corre aquí con las funciones
 *  puras importadas porque adminFindDuplicates exige auth admin. */
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

  // Fix 2026-09-21: las 2 comprobaciones (fuente distinta, fecha real ≤1
  // día) se hacen por PAR en el pairwise, no sobre el bucket agregado — un
  // bucket con carreras de fechas vecinas puede "contaminar" el conteo de
  // fuentes o dejar pasar pares que en realidad difieren 2 días reales. Ver
  // nota completa en convex/races.ts (adminFindDuplicates).
  const daysBetween = (d1: string, d2: string) =>
    Math.abs(new Date(d1 + "T00:00:00Z").getTime() - new Date(d2 + "T00:00:00Z").getTime()) / 86400000;

  // Detector 2: structural — bucket de fecha tolera ±1 día
  const byStructural = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate || !r.province) continue;
    const distBucket = Math.round(r.distanceKm * 2) / 2;
    for (const d of neighborDates(r.startDate)) {
      const k = `${d}|${r.province}|${distBucket}`;
      if (!byStructural.has(k)) byStructural.set(k, []);
      byStructural.get(k)!.push(r);
    }
  }
  for (const [, list] of byStructural) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if ((a.scraperAdapter ?? "manual") === (b.scraperAdapter ?? "manual")) continue;
        if (!a.startDate || !b.startDate || daysBetween(a.startDate, b.startDate) > 1) continue;
        if (!localitiesCompatible(a.locality, b.locality)) continue;
        if (Math.abs(a.distanceKm - b.distanceKm) > 0.1) continue;
        addGroup([a, b], "structural");
      }
    }
  }

  // Detector 3: fuzzy — bucket de fecha tolera ±1 día
  const byFuzzyBucket = new Map<string, RaceDoc[]>();
  for (const r of all) {
    if (!r.startDate) continue;
    const prov = r.province ?? r.locality ?? "?";
    for (const d of neighborDates(r.startDate)) {
      const k = `${d}|${prov}`;
      if (!byFuzzyBucket.has(k)) byFuzzyBucket.set(k, []);
      byFuzzyBucket.get(k)!.push(r);
    }
  }
  for (const [, list] of byFuzzyBucket) {
    if (list.length < 2) continue;
    const tokensList = list.map((r) => ({ r, t: tokenize(r.name) }));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = tokensList[i];
        const b = tokensList[j];
        if (!a.r.startDate || !b.r.startDate || daysBetween(a.r.startDate, b.r.startDate) > 1) continue;
        const sim = jaccard(a.t, b.t);
        if (sim >= similarityThreshold) addGroup([a.r, b.r], "fuzzy");
      }
    }
  }

  return Array.from(groups.values());
}

async function main() {
  console.log("=".repeat(70));
  console.log("Auto-merge de duplicados (post-ingest, sin confirmación)");
  console.log("=".repeat(70));

  const all = (await client.query(api.races.systemListAllDetailed, {})) as RaceDoc[];
  console.log(`Total carreras en BBDD: ${all.length}`);

  const groups = findDuplicateGroups(all);
  console.log(`Grupos duplicados detectados: ${groups.length}\n`);

  const runLog: Array<{
    reasonType: string;
    keepId: string;
    keepName: string;
    deletedIds: string[];
    deletedNames: string[];
  }> = [];
  let totalMerged = 0;
  let totalErrors = 0;

  for (const group of groups) {
    // countFields desc; empate -> _creationTime asc (la más vieja gana el "keep").
    const sorted = [...group.races].sort((a, b) => {
      const diff = countFields(b) - countFields(a);
      if (diff !== 0) return diff;
      return a._creationTime - b._creationTime;
    });
    const keep = sorted[0];
    const toDelete = sorted.slice(1);
    const deletedIds: string[] = [];
    const deletedNames: string[] = [];

    console.log(`\n📍 [${group.reasonType}] "${keep.name}" (${group.races.length} carreras):`);
    console.log(`   ✓ Conservar: ${keep._id} — "${keep.name}" (${countFields(keep)} campos, ${keep.scraperAdapter ?? "manual"})`);

    for (const d of toDelete) {
      console.log(`   → Fusionar y borrar: ${d._id} — "${d.name}" (${countFields(d)} campos, ${d.scraperAdapter ?? "manual"})`);
      try {
        const res = await client.mutation(api.races.systemMergeDuplicates, {
          keepId: keep._id as any,
          deleteId: d._id as any,
        });
        console.log(`     ✅ Fusionado. Migrado: ${JSON.stringify(res.migrated)}${Object.values(res.merged).some((v) => v > 0) ? ` | Conflictos resueltos: ${JSON.stringify(res.merged)}` : ""}`);
        deletedIds.push(d._id);
        deletedNames.push(d.name);
        totalMerged++;
      } catch (e: any) {
        console.error(`     ❌ Error fusionando ${d._id}: ${e?.message ?? e}`);
        totalErrors++;
      }
    }

    if (deletedIds.length > 0) {
      runLog.push({ reasonType: group.reasonType, keepId: keep._id, keepName: keep.name, deletedIds, deletedNames });
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`Grupos procesados: ${groups.length}`);
  console.log(`Carreras fusionadas: ${totalMerged}`);
  if (totalErrors > 0) console.log(`Errores: ${totalErrors}`);

  await client.mutation(api.dataSources.systemLogAutoMergeRun, {
    groupsProcessed: groups.length,
    totalMerged,
    totalErrors,
    details: runLog,
  });
  console.log("\n✅ Resumen persistido en autoMergeRuns (sendIngestSummaryEmail lo incluirá en el email nocturno)");
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
