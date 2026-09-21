// Smoke test del módulo puro de matching de duplicados
import {
  normalizeName,
  jaccard,
  tokenize,
  localitiesCompatible,
  findExistingMatch,
  MatchCandidate,
} from "../convex/duplicateMatching";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"}  ${label}`);
  if (cond) pass++;
  else fail++;
}

// --- normalizeName ---
check(
  "normalizeName quita ordinales y años",
  normalizeName("15ª Media Maratón de Xàtiva 2026") === "media maraton de xativa",
);
check(
  "normalizeName es case/acento-insensible",
  normalizeName("Cross de Carrús") === normalizeName("CROSS DE CARRUS"),
);

// --- jaccard ---
check(
  "jaccard de sets idénticos es 1",
  jaccard(tokenize("10K Villa de Rojales"), tokenize("10K Villa de Rojales")) === 1,
);
check(
  "jaccard de sets sin solapamiento es 0",
  jaccard(tokenize("Maratón de Valencia"), tokenize("Trail de Cuenca")) === 0,
);

// --- localitiesCompatible ---
check("localitiesCompatible acepta substring", localitiesCompatible("Xàtiva", "Xàtiva (Valencia)"));
check("localitiesCompatible acepta si una falta", localitiesCompatible(undefined, "Xàtiva"));
check(
  "localitiesCompatible rechaza localidades distintas",
  !localitiesCompatible("Valencia", "Alicante"),
);

// --- findExistingMatch: exact ---
const poolExact: MatchCandidate[] = [
  { name: "Cross de Carrús", startDate: "2026-11-15", scraperAdapter: "rfea", province: "alicante", distanceKm: 8 },
];
const exactResult = findExistingMatch(
  { name: "Cross de Carrus", startDate: "2026-11-15", scraperAdapter: "rfea" },
  poolExact,
);
check("findExistingMatch detecta exact (mismo source+nombre+fecha)", exactResult?.reason === "exact");

// --- findExistingMatch: structural (cross-source) ---
const poolStructural: MatchCandidate[] = [
  {
    name: "Media Marató de Xàtiva",
    startDate: "2026-10-04",
    scraperAdapter: "correbirras",
    province: "valencia",
    locality: "Xàtiva",
    distanceKm: 21.1,
  },
];
const structuralResult = findExistingMatch(
  {
    name: "21K Xàtiva",
    startDate: "2026-10-04",
    scraperAdapter: "sportmaniacs",
    province: "valencia",
    locality: "Xàtiva",
    distanceKm: 21.05,
  },
  poolStructural,
);
check(
  "findExistingMatch detecta structural (fecha+provincia+distancia cruzando fuentes)",
  structuralResult?.reason === "structural",
);

// --- findExistingMatch: fuzzy (cross-source, nombre similar) ---
const poolFuzzy: MatchCandidate[] = [
  {
    name: "Trail Ultra Helike Villena",
    startDate: "2026-05-09",
    scraperAdapter: "itra",
    province: "alicante",
  },
];
const fuzzyResult = findExistingMatch(
  {
    name: "Ultra Helike de Villena",
    startDate: "2026-05-09",
    scraperAdapter: "fedme",
    province: "alicante",
  },
  poolFuzzy,
);
check("findExistingMatch detecta fuzzy (nombre similar, Jaccard alto)", fuzzyResult?.reason === "fuzzy");

// --- findExistingMatch: NO debe matchear carreras distintas el mismo día ---
const poolDistinct: MatchCandidate[] = [
  {
    name: "10K Playa de San Juan",
    startDate: "2026-06-20",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Alicante",
    distanceKm: 10,
  },
];
const distinctResult = findExistingMatch(
  {
    name: "Media Maratón de Elche",
    startDate: "2026-06-20",
    scraperAdapter: "fedme",
    province: "alicante",
    locality: "Elche",
    distanceKm: 21.1,
  },
  poolDistinct,
);
check(
  "findExistingMatch NO matchea carreras distintas el mismo día (distancia y nombre distintos)",
  distinctResult === null,
);

// --- findExistingMatch: mismo source NO dispara si el nombre es realmente distinto (fuzzy exige similitud alta, no fuente distinta) ---
const poolSameSource: MatchCandidate[] = [
  {
    name: "Carrera Popular de Petrer",
    startDate: "2026-03-08",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Petrer",
    distanceKm: 10,
  },
];
const sameSourceDifferentNameResult = findExistingMatch(
  {
    name: "Otra Carrera Distinta",
    startDate: "2026-03-08",
    scraperAdapter: "rfea",
    province: "alicante",
    locality: "Petrer",
    distanceKm: 10,
  },
  poolSameSource,
);
check(
  "findExistingMatch no fusiona 2 carreras de la MISMA fuente si el nombre es realmente distinto (Jaccard bajo)",
  sameSourceDifferentNameResult === null,
);

// --- findExistingMatch: fuzzy SÍ dispara same-source cuando el nombre es similar (fix 2026-09-14) ---
const poolFuzzySameSource: MatchCandidate[] = [
  {
    name: "XVI Vuelta a Sierra Espuña",
    startDate: "2026-10-03",
    scraperAdapter: "correbirras",
    province: "murcia",
    locality: "Totana",
  },
];
const fuzzySameSourceResult = findExistingMatch(
  {
    name: "Vuelta Senderista a Sierra Espuña",
    startDate: "2026-10-03",
    scraperAdapter: "correbirras",
    province: "murcia",
    locality: "Totana",
  },
  poolFuzzySameSource,
);
check(
  "findExistingMatch SÍ fusiona 2 carreras de la MISMA fuente con nombre similar (Jaccard alto) — fix same-source",
  fuzzySameSourceResult?.reason === "fuzzy",
);

// --- findExistingMatch: structural NUNCA dispara same-source (sin cambios, test de regresión) ---
const poolStructuralSameSource: MatchCandidate[] = [
  {
    name: "38 Pas Ras al Port de Valencia",
    startDate: "2026-12-13",
    scraperAdapter: "carreraspopulares",
    province: "valencia",
    locality: "Valencia",
    distanceKm: 10,
  },
];
const structuralSameSourceResult = findExistingMatch(
  {
    name: "Carreras Infantiles Pas Ras al Port de Valencia",
    startDate: "2026-12-13",
    scraperAdapter: "carreraspopulares",
    province: "valencia",
    locality: "Valencia",
    distanceKm: 10,
  },
  poolStructuralSameSource,
);
check(
  "findExistingMatch NO fusiona por structural dentro de la MISMA fuente (evita el falso positivo real de 2026-09-14: carrera infantil vs adultos)",
  structuralSameSourceResult === null,
);

// --- findExistingMatch: veto por distancia real en fuzzy (fix 2026-09-14, hallazgo de code review) ---
const poolFuzzyDistanceVeto: MatchCandidate[] = [
  {
    name: "10K Carrera Nocturna Gandia",
    startDate: "2026-11-14",
    scraperAdapter: "correbirras",
    province: "valencia",
    distanceKm: 10,
  },
];
const fuzzyDistanceVetoResult = findExistingMatch(
  {
    name: "5K Carrera Nocturna Gandia",
    startDate: "2026-11-14",
    scraperAdapter: "correbirras",
    province: "valencia",
    distanceKm: 5,
  },
  poolFuzzyDistanceVeto,
);
check(
  "findExistingMatch NO fusiona por fuzzy cuando la distancia real difiere >1km, aunque el nombre sea casi idéntico salvo el número (hallazgo de code review 2026-09-14)",
  fuzzyDistanceVetoResult === null,
);

// --- findExistingMatch: tolerancia de fecha ±1 día (fix 2026-09-20) ---
// findExistingMatch en sí NO compara fechas para structural/fuzzy — depende
// de que el pool ya incluya las carreras vecinas (eso lo hace el CALLER:
// convex/races.ts systemUpsert/adminFindDuplicates y
// scripts/auto-merge-duplicates.ts, todos con su propio neighborDates()).
// Estos checks simulan exactamente ese patrón: el candidato tiene
// startDate=X, y el pool contiene una carrera existente con startDate=X-1
// o X+1 (como si el caller ya hubiera cargado los 3 días vecinos).

// structural tolera 1 día de diferencia (pool ya incluye el vecino)
const poolStructuralDateTolerance: MatchCandidate[] = [
  {
    name: "Media Marató de Xàtiva",
    startDate: "2026-10-03", // 1 día antes que el candidato
    scraperAdapter: "correbirras",
    province: "valencia",
    locality: "Xàtiva",
    distanceKm: 21.1,
  },
];
const structuralDateToleranceResult = findExistingMatch(
  {
    name: "21K Xàtiva",
    startDate: "2026-10-04",
    scraperAdapter: "sportmaniacs",
    province: "valencia",
    locality: "Xàtiva",
    distanceKm: 21.05,
  },
  poolStructuralDateTolerance,
);
check(
  "findExistingMatch detecta structural aunque la fecha difiera 1 día (pool con vecino, fix 2026-09-20 — ej. real: XXIII Carrera MTB Sierra de Noez, 2026-10-11 vs 2026-10-10)",
  structuralDateToleranceResult?.reason === "structural",
);

// fuzzy tolera 1 día de diferencia (pool ya incluye el vecino)
const poolFuzzyDateTolerance: MatchCandidate[] = [
  {
    name: "Trail Ultra Helike Villena",
    startDate: "2026-05-10", // 1 día después que el candidato
    scraperAdapter: "itra",
    province: "alicante",
  },
];
const fuzzyDateToleranceResult = findExistingMatch(
  {
    name: "Ultra Helike de Villena",
    startDate: "2026-05-09",
    scraperAdapter: "fedme",
    province: "alicante",
  },
  poolFuzzyDateTolerance,
);
check(
  "findExistingMatch detecta fuzzy aunque la fecha difiera 1 día (pool con vecino, fix 2026-09-20)",
  fuzzyDateToleranceResult?.reason === "fuzzy",
);

// exact NO tolera diferencia de fecha (a propósito, sin cambios) — aunque el
// pool incluya la carrera vecina de 1 día, exact solo debe activarse con
// fecha idéntica; en este caso debe caer a fuzzy (mismo nombre normalizado
// exacto = Jaccard 1.0 >= threshold), nunca a "exact".
const poolExactNoDateTolerance: MatchCandidate[] = [
  {
    name: "Cross de Carrús",
    startDate: "2026-11-16", // 1 día después que el candidato
    scraperAdapter: "rfea",
    province: "alicante",
    distanceKm: 8,
  },
];
const exactNoDateToleranceResult = findExistingMatch(
  { name: "Cross de Carrus", startDate: "2026-11-15", scraperAdapter: "rfea", province: "alicante", distanceKm: 8 },
  poolExactNoDateTolerance,
);
check(
  "findExistingMatch NO usa exact si la fecha difiere 1 día, aunque el pool incluya la carrera vecina (exact exige fecha idéntica a propósito, sin cambios 2026-09-20)",
  exactNoDateToleranceResult !== null && exactNoDateToleranceResult.reason !== "exact",
);

console.log(`\n${pass} OK, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
