// =============================================================================
// scripts/ingest-fam-madrid.ts
// =============================================================================
// Ingesta del calendario oficial de la Federación de Atletismo de Madrid
// (FAM) desde su export Excel público (módulo Joomla `mod_calendario`, sin
// autenticación — descubierto vía un link "Exportar" visible en el HTML
// normal de /calendario, ver docs/plans/SOURCES_RESEARCH.md §8.1).
//
//   GET https://www.atletismomadrid.com/component/ajax/?module=calendario
//       &method=export&format=raw&module_id=205&season={year}&Itemid=111
//   Respuesta: .xlsx con columnas
//     Fecha | Día | Fecha Fin | Día | Competición | Lugar | Tipo | Última modificación
//
// La columna "Tipo" mezcla campeonatos federados con carreras populares.
// Solo nos interesan los códigos de carrera a pie en ruta/montaña:
//   R     = Ruta (carreras populares, medias maratones, 10K, etc.)
//   TR/MT = Trail Running / Montaña
// El resto (PC=Pista Cubierta, AL=Aire Libre/pista, C=Cross, M=Marcha,
// O=Otros/divulgación, JA/JT=Jornadas escolares/tecnificación) son
// disciplinas de pista/campo a través/marcha, fuera del scope de mi-dorsal.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/ingest-fam-madrid.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/ingest-fam-madrid.ts --upload   # sube a Convex
//   npx tsx --env-file=.env.local scripts/ingest-fam-madrid.ts --season=2027 --upload
// =============================================================================

import * as XLSX from "xlsx";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const UPLOAD = process.argv.includes("--upload");
const seasonArg = process.argv.find((a) => a.startsWith("--season="));
const SEASON = seasonArg ? seasonArg.split("=")[1] : String(new Date().getFullYear());

const EXPORT_URL = `https://www.atletismomadrid.com/component/ajax/?module=calendario&method=export&format=raw&module_id=205&season=${SEASON}&Itemid=111`;

// Tipos que nos interesan (carrera a pie en ruta o montaña).
const RELEVANT_TYPES = new Set(["R", "TR/MT"]);

interface FamRow {
  name: string;
  locality: string;
  startDate: string; // YYYY-MM-DD
  tipo: string;
}

/** Convierte "dd-mm-yyyy" (o "dd-mm-yyyy hh:mm:ss") a "YYYY-MM-DD". */
function parseSpanishDate(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function inferRaceType(tipo: string): "road" | "trail" {
  return tipo === "TR/MT" ? "trail" : "road";
}

/** El campo "Lugar" a veces trae la localidad con provincia entre paréntesis,
 * p.ej. "Cieza (Murcia)" — nos quedamos solo con la localidad para
 * `locality`, la provincia se infiere después con un mapa manual. */
function splitLugar(lugar: string): { locality: string; parenProvince: string | null } {
  const m = lugar.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) return { locality: m[1].trim(), parenProvince: m[2].trim() };
  return { locality: lugar.trim(), parenProvince: null };
}

/** Mapa de localidades conocidas de la Comunidad de Madrid → provincia
 * "madrid" (schema de mi-dorsal usa provincias, no CCAA). El calendario FAM
 * incluye carreras fuera de Madrid (campeonatos de España en otras
 * provincias) — para esas usamos el paréntesis si existe, o se dejan sin
 * provincia (el admin las revisará, igual que otros ingests con datos
 * incompletos). */
const KNOWN_MADRID_LOCALITIES = new Set([
  "madrid", "gallur", "móstoles", "mostoles", "vicálvaro", "vicalvaro", "aluche",
  "getafe", "parla", "torrejón de ardoz", "torrejon de ardoz", "carabanchel",
  "alcobendas", "collado villalba", "patones", "valdemoro", "paracuellos de jarama",
  "alcalá de henares", "alcala de henares", "leganés", "leganes", "fuenlabrada",
  "coslada", "pozuelo de alarcón", "pozuelo de alarcon", "las rozas", "majadahonda",
  "san sebastián de los reyes", "san sebastian de los reyes", "boadilla del monte",
  "rivas-vaciamadrid", "rivas vaciamadrid", "villaviciosa de odón", "villaviciosa de odon",
  "arganda del rey", "aranjuez", "colmenar viejo", "el escorial", "san lorenzo de el escorial",
  "villalba", "tres cantos", "navalcarnero", "villarejo de salvanés",
]);

const PAREN_TO_PROVINCE: Record<string, string> = {
  murcia: "murcia",
  barcelona: "barcelona",
  asturias: "asturias",
  asturies: "asturias",
  cantabria: "cantabria",
  pontevedra: "pontevedra",
  málaga: "malaga",
  malaga: "malaga",
  palencia: "palencia",
  castellón: "castellon",
  castellon: "castellon",
  usa: "extranjero",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function inferProvince(locality: string, parenProvince: string | null): string | null {
  if (KNOWN_MADRID_LOCALITIES.has(normalize(locality))) return "madrid";
  if (parenProvince) {
    const mapped = PAREN_TO_PROVINCE[normalize(parenProvince)];
    if (mapped && mapped !== "extranjero") return mapped;
  }
  // Fallback: la FAM es la federación de Madrid, la inmensa mayoría de su
  // calendario ocurre en Madrid aunque la localidad no esté en nuestra
  // lista manual (municipios pequeños no listados arriba).
  return "madrid";
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function downloadWorkbook(): Promise<XLSX.WorkBook> {
  console.log(`[FAM] Descargando calendario ${SEASON} desde ${EXPORT_URL}...`);
  const res = await fetch(EXPORT_URL, {
    headers: { "User-Agent": "mi-dorsal/0.1 (corredor-popular)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el calendario FAM`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`[FAM] Descargado (${(buf.length / 1024).toFixed(1)} KB)`);
  return XLSX.read(buf, { type: "buffer" });
}

function parseWorkbook(wb: XLSX.WorkBook): FamRow[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const [header, ...data] = rows;
  console.log(`[FAM] Cabecera: ${JSON.stringify(header)}`);
  console.log(`[FAM] Filas totales: ${data.length}`);

  const out: FamRow[] = [];
  for (const r of data) {
    const [fechaRaw, , , , competicion, lugar, tipo] = r;
    if (!competicion || !tipo) continue;
    if (!RELEVANT_TYPES.has(String(tipo).trim())) continue;

    const startDate = parseSpanishDate(String(fechaRaw ?? ""));
    if (!startDate) continue;

    out.push({
      name: String(competicion).trim(),
      locality: String(lugar ?? "").trim(),
      startDate,
      tipo: String(tipo).trim(),
    });
  }
  return out;
}

async function main() {
  console.log("=".repeat(70));
  console.log("Ingest del calendario de la Federación de Atletismo de Madrid (FAM)");
  console.log("=".repeat(70));
  console.log(`Temporada: ${SEASON}`);
  console.log(`Modo: ${UPLOAD ? "UPLOAD A PROD" : "DRY-RUN (añade --upload para subir)"}\n`);

  const wb = await downloadWorkbook();
  const allRows = parseWorkbook(wb);
  console.log(`\n[FAM] Filas de tipo Ruta/Trail: ${allRows.length}`);

  // Filtrar solo futuras.
  const today = new Date().toISOString().split("T")[0];
  const future = allRows.filter((r) => r.startDate >= today);
  console.log(`[FAM] Futuras (>= ${today}): ${future.length}`);

  if (future.length === 0) {
    console.log("\n[FAM] No hay carreras futuras de tipo Ruta/Trail. Nada que ingestar.");
    return;
  }

  // Dedup por (nombre normalizado + fecha) — el mismo evento puede aparecer
  // más de una vez en el calendario si hay revisiones.
  const dedupMap = new Map<string, FamRow>();
  for (const r of future) {
    const key = `${normalizeName(r.name)}|${r.startDate}`;
    if (!dedupMap.has(key)) dedupMap.set(key, r);
  }
  const rows = Array.from(dedupMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));

  console.log(`[FAM] Tras dedup: ${rows.length}`);
  console.log("\n[FAM] Primeras 10:");
  for (const r of rows.slice(0, 10)) {
    console.log(`  ${r.startDate}  [${r.tipo}]  ${r.name}  (${r.locality})`);
  }

  if (!UPLOAD) {
    console.log("\nPara subir a Convex: añade --upload");
    return;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  console.log("\nAsegurando dataSource 'fam-madrid'…");
  const sources = await client.query(api.dataSources.listPublic, {});
  let src = sources.find((s: any) => s.slug === "fam-madrid");
  if (!src) {
    const id = await client.mutation(api.dataSources.systemCreate, {
      name: "Federación de Atletismo de Madrid",
      slug: "fam-madrid",
      type: "api",
      description:
        "Calendario oficial de la Comunidad de Madrid — export Excel público (Joomla mod_calendario, sin auth)",
      baseUrl: "https://www.atletismomadrid.com",
      config: { scrapedAt: new Date().toISOString() },
    });
    src = { _id: id } as any;
    console.log(`   ✅ Fuente 'fam-madrid' creada: ${id}`);
  } else {
    console.log(`   ✅ Fuente 'fam-madrid' ya existe: ${src._id}`);
  }
  const sourceId = src._id;

  console.log(`\nSubiendo ${rows.length} carreras (idempotente)…\n`);
  let created = 0,
    updated = 0,
    failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of rows) {
    const { locality, parenProvince } = splitLugar(r.locality);
    const province = inferProvince(locality, parenProvince);
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: locality || undefined,
        province: (province as any) ?? undefined,
        raceType: inferRaceType(r.tipo),
        startDate: r.startDate,
        organizer: "Federación de Atletismo de Madrid",
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "fam-madrid",
        dataSourceId: sourceId,
      });
      if (res?.action === "created") {
        created++;
        process.stdout.write(".");
      } else {
        updated++;
        process.stdout.write("u");
      }
    } catch (err: any) {
      failed++;
      process.stdout.write("x");
      if (errors.length < 5) errors.push(`${r.name}: ${err?.message ?? err}`);
    }
  }

  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas, ${failed} fallaron`);
  if (errors.length) console.log("Errores (max 5):", errors);

  try {
    const durationMs = Date.now() - uploadT0;
    const status: "success" | "error" = failed > created + updated ? "error" : "success";
    await client.mutation(api.dataSources.recordIngestSync, {
      dataSourceSlug: "fam-madrid",
      raceCount: created + updated,
      createdCount: created,
      updatedCount: updated,
      durationMs,
      status,
      triggeredBy: "manual",
      error: failed > 0 ? `${failed} carreras fallaron` : undefined,
    });
  } catch (err) {
    console.error("  ✗ error registrando sync:", err);
  }
}

main().catch((err) => {
  console.error("❌ [FAM] Error fatal:", err);
  process.exit(1);
});
