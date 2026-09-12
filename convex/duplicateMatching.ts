// =============================================================================
// mi-dorsal — Matching de carreras duplicadas (módulo puro, sin ctx.db)
// =============================================================================
// Funciones de normalización y detección compartidas entre:
//   - convex/races.ts -> adminFindDuplicates (panel /admin/duplicates)
//   - convex/races.ts -> systemUpsert (ingest nocturno, previene duplicados
//     en origen en vez de detectarlos después)
//
// Es un módulo PURO a propósito: no importa nada de "./_generated/server"
// ni recibe ctx.db, para poder usarse igual desde una query (adminFindDuplicates)
// y desde una mutation (systemUpsert) sin acoplar tipos de contexto.
// =============================================================================

export type MatchReason = "exact" | "structural" | "fuzzy";

/** Forma mínima que necesita cualquier carrera (existente o candidata) para el matching. */
export interface MatchCandidate {
  name: string;
  startDate?: string;
  province?: string;
  locality?: string;
  distanceKm?: number;
  scraperAdapter?: string;
}

// ---------------------------------------------------------------------------
// Normalización de nombres
// ---------------------------------------------------------------------------

function stripOrdinals(s: string): string {
  // Nota: sin \b final tras la marca ordinal — [ºª°] no es \w en JS regex,
  // así que un \b entre la marca y el espacio siguiente (ambos no-\w) nunca
  // matchea y la marca de ordinal (y el número que la precede) no se elimina.
  return s
    .replace(/\b\d{1,3}[ºª°]/g, " ")
    .replace(/\b(X{0,3})(IX|IV|V?I{1,3}|X{1,2})\b/g, " ");
}

function stripYear(s: string): string {
  return s
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(edici[oó]n|ed\.?)\b/gi, " ");
}

export function normalizeName(s: string): string {
  // Quitamos los acentos ANTES de stripOrdinals/stripYear: una letra acentuada
  // (á, à, ñ...) no es \w para el motor de regex de JS, así que dejarla en el
  // string hace que \b la trate como límite de palabra y stripOrdinals corte
  // mal (p.ej. "Xàtiva" se leería como "X" + "àtiva" y la X se eliminaría
  // como si fuera un numeral romano).
  const deaccented = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return stripYear(stripOrdinals(deaccented))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(s: string): Set<string> {
  // length > 2 (no > 1): descarta también partículas de 2 letras ("de", "la",
  // "el"...) que si no generarían solapamiento Jaccard artificial entre
  // carreras completamente distintas que sólo comparten esas partículas.
  return new Set(normalizeName(s).split(" ").filter((t) => t.length > 2));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normLocality(s: string | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function localitiesCompatible(a: string | undefined, b: string | undefined): boolean {
  const na = normLocality(a);
  const nb = normLocality(b);
  if (!na || !nb) return true; // si una falta, no descartar
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ---------------------------------------------------------------------------
// findExistingMatch: prueba exact -> structural -> fuzzy, en ese orden.
// `pool` debe ser un conjunto ya acotado (p.ej. carreras de la misma fecha,
// cargadas vía índice by_date) — esta función NO consulta la BD.
// ---------------------------------------------------------------------------

export function findExistingMatch<T extends MatchCandidate>(
  candidate: MatchCandidate,
  pool: T[],
  opts?: { similarityThreshold?: number },
): { race: T; reason: MatchReason } | null {
  const similarityThreshold = opts?.similarityThreshold ?? 0.75;
  const candidateNorm = normalizeName(candidate.name);
  const candidateSource = candidate.scraperAdapter ?? "manual";

  // 1. exact: mismo scraperAdapter + nombre normalizado + misma fecha
  if (candidateNorm && candidate.startDate) {
    const exactMatch = pool.find(
      (r) =>
        (r.scraperAdapter ?? "manual") === candidateSource &&
        normalizeName(r.name) === candidateNorm &&
        r.startDate === candidate.startDate,
    );
    if (exactMatch) return { race: exactMatch, reason: "exact" };
  }

  // 2. structural: misma fecha + provincia + distancia (±0.1km) + localidad compatible,
  // cruzando fuentes (si fuera la misma fuente, el paso 1 ya la habría cogido)
  if (candidate.province && candidate.distanceKm !== undefined) {
    const structuralMatch = pool.find((r) => {
      if ((r.scraperAdapter ?? "manual") === candidateSource) return false;
      if (r.province !== candidate.province) return false;
      if (r.distanceKm === undefined) return false;
      if (Math.abs(r.distanceKm - candidate.distanceKm!) > 0.1) return false;
      return localitiesCompatible(r.locality, candidate.locality);
    });
    if (structuralMatch) return { race: structuralMatch, reason: "structural" };
  }

  // 3. fuzzy: misma fecha + provincia (o localidad si no hay provincia),
  // similitud de nombre por Jaccard >= threshold, cruzando fuentes
  if (candidateNorm) {
    const candidateTokens = tokenize(candidate.name);
    const candidateProv = candidate.province ?? candidate.locality ?? "?";
    let best: { race: T; sim: number } | null = null;
    for (const r of pool) {
      if ((r.scraperAdapter ?? "manual") === candidateSource) continue;
      const rProv = r.province ?? r.locality ?? "?";
      if (rProv !== candidateProv) continue;
      const sim = jaccard(candidateTokens, tokenize(r.name));
      if (sim >= similarityThreshold && (!best || sim > best.sim)) {
        best = { race: r, sim };
      }
    }
    if (best) return { race: best.race, reason: "fuzzy" };
  }

  return null;
}
