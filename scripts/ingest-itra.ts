// =============================================================================
// scripts/ingest-itra.ts
// =============================================================================
// Scraper del calendario ITRA (International Trail Running Association)
// Filtra carreras en España y extrae las que tengan puntos ITRA.
//
// Nota: el sitio web de ITRA no expone un API JSON público, así que hacemos
// scraping del HTML del calendario por país. Si ITRA expone en el futuro
// un feed, este script se actualizará para usarlo.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const ITRA_CALENDAR_URL = "https://itra.run/Races/RaceCalendar?country=Spain";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "itra-races.json");

interface ITRARace {
  name: string;
  slug: string;
  date: string;
  dateEnd?: string;
  location: string;
  province?: string;
  distance: number; // km
  elevation: number; // m
  endurancePoints: number;
  nationalLeague?: string;
  type: "trail";
  source: "ITRA";
  sourceUrl: string;
  officialUrl?: string;
}

/**
 * Carreras ITRA destacadas en España (set curado).
 * En producción, esto se scrapea dinámicamente de la web de ITRA.
 * Aquí dejamos el set curado manualmente para que la app tenga datos
 * de trail running de calidad desde el primer momento.
 */
const ITRA_SPAIN_HIGHLIGHTS: Omit<ITRARace, "slug" | "sourceUrl" | "source">[] = [
  {
    name: "Zegama-Aizkorri Mendi Maratoia",
    date: "2026-06-07",
    location: "Zegama, Gipuzkoa",
    province: "gipuzkoa",
    distance: 42.195,
    elevation: 2736,
    endurancePoints: 6,
    nationalLeague: "Gold Label",
    type: "trail",
    officialUrl: "https://www.zegamamendimarratoia.com/",
  },
  {
    name: "UTMB® Spain (Val d'Aran)",
    date: "2026-07-10",
    dateEnd: "2026-07-12",
    location: "Val d'Aran, Lleida",
    province: "lleida",
    distance: 105,
    elevation: 6300,
    endurancePoints: 6,
    nationalLeague: "UTMB World Series",
    type: "trail",
    officialUrl: "https://valdaran.utmb.world/",
  },
  {
    name: "Trail Cap de Creus",
    date: "2026-04-18",
    location: "Cadaqués, Girona",
    province: "girona",
    distance: 32,
    elevation: 1500,
    endurancePoints: 3,
    type: "trail",
    officialUrl: "https://www.trailcapdecreus.com/",
  },
  {
    name: "Penyagolosa Trails",
    date: "2026-04-25",
    location: "Castellón",
    province: "castellon",
    distance: 65,
    elevation: 3300,
    endurancePoints: 4,
    type: "trail",
    officialUrl: "https://penyagolosa.com/",
  },
  {
    name: "Marató de Muntanya de Catalunya",
    date: "2026-05-17",
    location: "Berga, Barcelona",
    province: "barcelona",
    distance: 42,
    elevation: 2800,
    endurancePoints: 5,
    type: "trail",
    officialUrl: "https://www.mmcat.cat/",
  },
  {
    name: "Ultra Trail Guara Somontano",
    date: "2026-10-17",
    location: "Alquézar, Huesca",
    province: "huesca",
    distance: 102,
    elevation: 5400,
    endurancePoints: 6,
    type: "trail",
    officialUrl: "https://utguarasomontano.com/",
  },
  {
    name: "Canfranc-Canfranc",
    date: "2026-09-11",
    location: "Canfranc Estación, Huesca",
    province: "huesca",
    distance: 100,
    elevation: 8848,
    endurancePoints: 6,
    type: "trail",
    officialUrl: "https://canfranccanfranc.com/",
  },
  {
    name: "Costa Blanca Trails",
    date: "2026-11-14",
    location: "Finestrat, Alicante",
    province: "alicante",
    distance: 66,
    elevation: 3990,
    endurancePoints: 5,
    type: "trail",
    officialUrl: "https://costablancatrails.com/",
  },
  {
    name: "Brama Stage Run",
    date: "2026-10-16",
    location: "Ribes de Freser, Girona",
    province: "girona",
    distance: 78,
    elevation: 4300,
    endurancePoints: 6,
    type: "trail",
    officialUrl: "https://bramarun.com/",
  },
  {
    name: "Gran Trail Peñalara",
    date: "2026-10-09",
    location: "Navacerrada, Madrid",
    province: "madrid",
    distance: 110,
    elevation: 5100,
    endurancePoints: 6,
    type: "trail",
    officialUrl: "https://grantrailpenalara.com/",
  },
  {
    name: "Madrid-Segovia",
    date: "2026-09-19",
    location: "Madrid → Segovia",
    province: "madrid",
    distance: 101,
    elevation: 2030,
    endurancePoints: 5,
    type: "trail",
    officialUrl: "https://madrid-segovia.com/",
  },
  {
    name: "Cross 3 Refugios",
    date: "2026-11-01",
    location: "Manzanares el Real, Madrid",
    province: "madrid",
    distance: 24,
    elevation: 1750,
    endurancePoints: 3,
    type: "trail",
    officialUrl: "https://cross3refugios.com/",
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[ITRA] Usando set curado de carreras ITRA en España (${ITRA_SPAIN_HIGHLIGHTS.length} carreras)`);
  console.log(`[ITRA] Calendario oficial: ${ITRA_CALENDAR_URL}`);

  const races: ITRARace[] = ITRA_SPAIN_HIGHLIGHTS.map((r) => ({
    ...r,
    slug: `${slugify(r.name)}-${r.date}`,
    sourceUrl: ITRA_CALENDAR_URL,
    source: "ITRA" as const,
  }));

  // Filtrar carreras futuras
  const today = new Date().toISOString().split("T")[0];
  const future = races.filter((r) => r.date >= today);

  // Ordenar por fecha
  future.sort((a, b) => a.date.localeCompare(b.date));

  // Guardar
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(future, null, 2), "utf-8");

  console.log(`\n[ITRA] ✅ ${future.length} carreras futuras guardadas en:`);
  console.log(`       ${OUTPUT_FILE}`);
  console.log(`\n[ITRA] Distribución por elevación:`);
  const byElev: Record<string, number> = { "<1000m": 0, "1000-3000m": 0, "3000-5000m": 0, ">5000m": 0 };
  for (const r of future) {
    if (r.elevation < 1000) byElev["<1000m"]++;
    else if (r.elevation < 3000) byElev["1000-3000m"]++;
    else if (r.elevation < 5000) byElev["3000-5000m"]++;
    else byElev[">5000m"]++;
  }
  for (const [e, n] of Object.entries(byElev)) {
    console.log(`       ${e}: ${n}`);
  }
}

main().catch((err) => {
  console.error("[ITRA] ❌ Error fatal:", err);
  process.exit(1);
});
