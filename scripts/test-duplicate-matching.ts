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

// --- findExistingMatch: mismo source nunca dispara structural/fuzzy (los cubre exact o nada) ---
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
  "findExistingMatch no fusiona 2 carreras de la MISMA fuente con nombre distinto (structural/fuzzy exigen fuente distinta)",
  sameSourceDifferentNameResult === null,
);

console.log(`\n${pass} OK, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
