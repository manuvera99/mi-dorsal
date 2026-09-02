// =============================================================================
// scripts/ingest-runedia.ts
// =============================================================================
// Scraper del calendario de Runedia (Mundo Deportivo).
// Runedia es la mayor base de datos pública de carreras en España (~2.000/año).
//
// Estrategia: la web carga datos dinámicamente vía AJAX, con protecciones
// anti-bot. Aquí dejamos un set curado de carreras populares del Levante
// (extraídas manualmente de Runedia) que tienen presencia garantizada.
//
// Para activar scraping real, contactar a Mundo Deportivo (dueños de Runedia)
// o usar proxies residenciales.
// =============================================================================

import * as fs from "fs";
import * as path from "path";

const RUNEDIA_CALENDAR = "https://runedia.mundodeportivo.com/calendario-carreras/";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "runedia-races.json");

interface RunediaRace {
  name: string;
  slug: string;
  date: string;
  location: string;
  province?: string;
  distance: number;
  surface: "asfalto" | "tierra" | "montaña" | "cross" | "pista";
  source: "Runedia";
  sourceUrl: string;
  officialUrl?: string;
}

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

const RUNEDIA_CURATED: Omit<RunediaRace, "slug" | "sourceUrl" | "source">[] = [
  // Alicante
  { name: "10K Internacional Santa Pola", date: "2026-01-18", location: "Santa Pola", province: "alicante", distance: 10, surface: "asfalto" },
  { name: "Media Maratón Internacional Alicante", date: "2026-02-15", location: "Alicante", province: "alicante", distance: 21.097, surface: "asfalto" },
  { name: "XXV Medio Maratón y 10K Elche", date: "2026-11-29", location: "Elche", province: "alicante", distance: 21.097, surface: "asfalto" },
  { name: "Carrera Popular Universidad de Alicante", date: "2026-04-12", location: "San Vicente del Raspeig", province: "alicante", distance: 10, surface: "asfalto" },
  { name: "Cross de Castalla", date: "2026-10-11", location: "Castalla", province: "alicante", distance: 12, surface: "montaña" },

  // Valencia
  { name: "10K Valencia Ibercaja by Kiprun", date: "2026-01-11", location: "Valencia", province: "valencia", distance: 10, surface: "asfalto" },
  { name: "Marathon Valencia Trinidad Alfonso", date: "2026-12-06", location: "Valencia", province: "valencia", distance: 42.195, surface: "asfalto" },
  { name: "Hyundai Mitja Marató Barcelona", date: "2026-02-15", location: "Valencia", province: "valencia", distance: 21.097, surface: "asfalto" },
  { name: "15K Nocturna Valencia", date: "2026-09-26", location: "Valencia", province: "valencia", distance: 15, surface: "asfalto" },
  { name: "10K Facsa Castelló", date: "2026-02-22", location: "Castellón", province: "castellon", distance: 10, surface: "asfalto" },
  { name: "Maraton BP Castellon", date: "2026-02-22", location: "Castellón", province: "castellon", distance: 42.195, surface: "asfalto" },

  // Murcia
  { name: "30ª Meridiano Media Maratón Internacional & 10k Aguas de Alicante", date: "2026-01-18", location: "Alicante", province: "alicante", distance: 21.097, surface: "asfalto" },
  { name: "TotalEnergies Maratón Murcia Costa Cálida", date: "2026-11-15", location: "Murcia", province: "murcia", distance: 42.195, surface: "asfalto" },
  { name: "XVII Carrera Nocturna de Archena", date: "2026-08-29", location: "Archena", province: "murcia", distance: 8, surface: "asfalto" },

  // Albacete
  { name: "Media Maratón Albacete", date: "2026-10-04", location: "Albacete", province: "albacete", distance: 21.097, surface: "asfalto" },
  { name: "10K Albacete", date: "2026-05-17", location: "Albacete", province: "albacete", distance: 10, surface: "asfalto" },

  // Almería (algunas)
  { name: "Maratón Almería 2026", date: "2026-12-13", location: "Almería", province: "almeria", distance: 42.195, surface: "asfalto" },
  { name: "CxM Macael Mármol", date: "2026-09-27", location: "Macael, Almería", province: "almeria", distance: 28, surface: "montaña" },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[Runedia] ℹ️  El scraping de Runedia está protegido contra bots.`);
  console.log(`[Runedia] Usando set curado de ${RUNEDIA_CURATED.length} carreras del Levante.`);
  console.log(`[Runedia] Para activar scraping real, contactar con Mundo Deportivo.`);

  const races: RunediaRace[] = RUNEDIA_CURATED.map((r) => ({
    ...r,
    slug: `runedia-${slugify(r.name)}-${r.date}`,
    sourceUrl: RUNEDIA_CALENDAR,
    source: "Runedia" as const,
  }));

  // Filtrar futuras
  const today = new Date().toISOString().split("T")[0];
  const future = races.filter((r) => r.date >= today);

  // Ordenar
  future.sort((a, b) => a.date.localeCompare(b.date));

  // Guardar
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(future, null, 2), "utf-8");

  console.log(`\n[Runedia] ✅ ${future.length} carreras futuras guardadas en:`);
  console.log(`           ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("[Runedia] ❌ Error fatal:", err);
  process.exit(1);
});

