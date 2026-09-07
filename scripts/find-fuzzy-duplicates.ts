// =============================================================================
// scripts/find-fuzzy-duplicates.ts
// =============================================================================
// Análisis de duplicados APROXIMADOS (fuzzy) entre carreras.
//
// A diferencia de fix-same-source-duplicates (que matchea nombre EXACTO
// normalizado), este script atrapa:
//   - Variaciones con/sin año: "Canfranc-Canfranc 2026" vs "Canfranc-Canfranc"
//   - Variaciones con ordinales: "XIII Carrera" vs "13 Carrera" vs "13ª Carrera"
//   - Variaciones de romanos: "XXIX Medio Maratón" vs "29º Medio Maratón"
//   - Errores tipográficos: "Carrera del Peurto" vs "Carrera del Puerto"
//
// Estrategia:
//   1) Normalizar nombre: lowercase, sin tildes, sin ordinales/romanos/año/edición
//   2) Bucketizar por (fecha, provincia) para evitar O(n²)
//   3) Dentro de cada bucket, calcular Jaccard de tokens + Levenshtein
//      sobre la cadena normalizada
//   4) Reportar pares con similitud >= 0.75
//
// ES UN ANALIZADOR (no borra nada). Para borrar, usar fix-same-source-duplicates
// (que ya tiene el flujo de mantener-el-más-completo).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/find-fuzzy-duplicates.ts
//   npx tsx --env-file=.env.local scripts/find-fuzzy-duplicates.ts --threshold=0.85
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const args = process.argv.slice(2);
const THRESHOLD = Number(args.find((a) => a.startsWith("--threshold="))?.split("=")[1]) || 0.75;

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl);

// =============================================================================
// Normalización de nombres
// =============================================================================

/** Convierte ordinales y romanos a un placeholder neutro */
function stripOrdinals(s: string): string {
  return s
    // Ordinales: 1º, 2ª, 3°, 23ª, etc.
    .replace(/\b\d{1,3}[ºª°]\b/g, " ")
    // Romanos: I, II, III, IV, V, VI, ..., XXXIX (mayúsculas o minúsculas con espacio alrededor)
    .replace(/\b(X{0,3})(IX|IV|V?I{0,3})\b/g, (m) => (m.length <= 3 ? " " : m))
    .replace(/\b(XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX)\b/g, " ")
    .replace(/\b(X{0,3})(IX|IV|VI{0,3})\b/g, " ");
}

/** Quita años (4 dígitos) y marcadores de edición */
function stripYear(s: string): string {
  return s
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(edici[oó]n|ed\.?)\b/gi, " ")
    .replace(/\b\d{1,2}[ªº°]?\s+(edici[oó]n|ed\.?)\b/gi, " ");
}

/** Normalización principal: lowercase, sin tildes, solo alfanumérico + espacios */
function normalize(s: string): string {
  return stripYear(stripOrdinals(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Tokens para Jaccard */
function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1));
}

// =============================================================================
// Similitud
// =============================================================================

/** Jaccard de tokens: |A ∩ B| / |A ∪ B| */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Levenshtein normalizado a [0,1] (1 = idénticas) */
function levenshteinNorm(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
}

function similarity(a: string, b: string): { jaccard: number; lev: number; combined: number } {
  const ja = jaccard(tokens(a), tokens(b));
  const le = levenshteinNorm(normalize(a), normalize(b));
  // Combinado: favorece el método que más se ajusta a cada caso
  // - Jaccard alto → mismo set de palabras
  // - Lev alto → misma cadena casi idéntica
  // - Uno solo alto basta si es >= 0.9
  const combined = Math.max(ja, le);
  return { jaccard: ja, lev: le, combined };
}

// =============================================================================
// Detección
// =============================================================================

interface Race {
  _id: string;
  name: string;
  slug: string;
  locality: string | null;
  province: string | null;
  startDate: string | null;
  startTime: string | null;
  scraperAdapter: string | null;
  officialUrl: string | null;
  extractedAt: number | null;
  distanceKm: number;
  fieldsCount: number;
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

function bucketKey(r: Race): string {
  // Bucket: (date, province) — si no hay province, locality. Si no hay nada, solo date.
  const d = r.startDate ?? "?";
  const p = r.province ?? (r.locality ? r.locality.toLowerCase().slice(0, 12) : "?");
  return `${d}|${p}`;
}

async function main() {
  console.log("=".repeat(78));
  console.log(`Análisis de duplicados APROXIMADOS (umbral: ${THRESHOLD})`);
  console.log("=".repeat(78));
  console.log("Estrategia:");
  console.log("  1. Normalizar: lowercase, sin tildes, sin ordinales/romanos/año/edición");
  console.log("  2. Bucket por (fecha, provincia) para evitar O(n²)");
  console.log("  3. Jaccard(tokens) + Levenshtein(normalized)");
  console.log("  4. Flag si combined >= umbral");
  console.log("");

  // systemListAllDetailed devuelve TODOS los campos, suficiente para análisis
  const raw: any[] = await client.query(api.races.systemListAllDetailed, {} as any);
  console.log(`Total carreras: ${raw.length}`);

  const races: Race[] = raw.map((r) => ({
    _id: r._id,
    name: r.name,
    slug: r.slug,
    locality: r.locality ?? null,
    province: r.province ?? null,
    startDate: r.startDate ?? null,
    startTime: r.startTime ?? null,
    scraperAdapter: r.scraperAdapter ?? null,
    officialUrl: r.officialUrl ?? null,
    extractedAt: r.extractedAt ?? null,
    distanceKm: r.distanceKm,
    fieldsCount: countFields(r),
  }));

  // Bucket
  const buckets = new Map<string, Race[]>();
  for (const r of races) {
    const k = bucketKey(r);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }

  // Detectar pares dentro de cada bucket
  const pairs: Array<{ a: Race; b: Race; sim: ReturnType<typeof similarity> }> = [];
  for (const [k, list] of buckets.entries()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // Skip si son de fuentes distintas y nombres muy distintos (probablemente OK)
        const sim = similarity(a.name, b.name);
        if (sim.combined >= THRESHOLD) {
          pairs.push({ a, b, sim });
        }
      }
    }
  }

  // Ordenar por similitud descendente
  pairs.sort((x, y) => y.sim.combined - x.sim.combined);

  console.log(`\nPares con similitud >= ${THRESHOLD}: ${pairs.length}\n`);

  if (pairs.length === 0) {
    console.log("✅ No hay duplicados fuzzy por encima del umbral");
    return;
  }

  // Mostrar agrupados por buckets (es más legible)
  let lastBucket = "";
  for (const { a, b, sim } of pairs) {
    const bucket = bucketKey(a);
    if (bucket !== lastBucket) {
      console.log(`\n── Bucket ${bucket} ──`);
      lastBucket = bucket;
    }
    console.log(`  [${(sim.combined * 100).toFixed(0)}% ja=${(sim.jaccard * 100).toFixed(0)}% lev=${(sim.lev * 100).toFixed(0)}%]`);
    console.log(`    A: [${a.fieldsCount}campos, ${a.scraperAdapter ?? "manual"}, ${a.province ?? "?"}] "${a.name}"`);
    console.log(`       id=${a._id}  slug=${a.slug}`);
    console.log(`    B: [${b.fieldsCount}campos, ${b.scraperAdapter ?? "manual"}, ${b.province ?? "?"}] "${b.name}"`);
    console.log(`       id=${b._id}  slug=${b.slug}`);
  }

  // Resumen
  const bySource = new Map<string, number>();
  let sameSourceCount = 0;
  let crossSourceCount = 0;
  for (const { a, b } of pairs) {
    if (a.scraperAdapter === b.scraperAdapter) sameSourceCount++;
    else crossSourceCount++;
    const k = `${a.scraperAdapter ?? "manual"}+${b.scraperAdapter ?? "manual"}`;
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
  }

  console.log("\n" + "=".repeat(78));
  console.log("RESUMEN");
  console.log("=".repeat(78));
  console.log(`Pares detectados:            ${pairs.length}`);
  console.log(`  same-source:               ${sameSourceCount}  (candidato directo para fix-same-source-duplicates)`);
  console.log(`  cross-source:              ${crossSourceCount}  (candidato para find-cross-source-duplicates --execute)`);
  console.log(`Carreras únicas involucradas: ${new Set(pairs.flatMap((p) => [p.a._id, p.b._id])).size}`);
  console.log("\nDesglose por par de fuentes:");
  for (const [k, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${n}`);
  }
  console.log("");
  console.log("Acciones sugeridas:");
  console.log("  1. Revisar cada par manualmente (nombre, fecha, localidad)");
  console.log("  2. Si es claramente la misma carrera:");
  console.log("     - same-source: npx tsx ... scripts/fix-same-source-duplicates.ts (o ejecutar el existente si --execute)");
  console.log("     - cross-source: npx tsx ... scripts/find-cross-source-duplicates.ts --execute");
  console.log("  3. Si no, déjalo: puede ser misma carrera en edición distinta del año siguiente");
}

main().catch((e) => { console.error(e); process.exit(1); });
