// =============================================================================
// scripts/ingest-to-convex.ts
// =============================================================================
// Lee scripts/output/all-races.json y sube cada carrera a Convex vía la
// mutation api.races.create.
//
// Uso:
//   1. Configurar .env.local con NEXT_PUBLIC_CONVEX_URL y CONVEX_DEPLOYMENT
//   2. Tener el schema desplegado (`npx convex dev`)
//   3. Ejecutar: npm run ingest:to-convex
//
// Si no hay Convex configurado, el script avisa y termina.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const OUTPUT_DIR = path.join(process.cwd(), "scripts", "output");
const UNIFIED_FILE = path.join(OUTPUT_DIR, "all-races.json");

interface UnifiedRace {
  name: string;
  slug: string;
  date: string;
  dateEnd?: string;
  location: string;
  province?: string;
  type: "road" | "trail" | "mixed" | "obstacle";
  modality?: string;
  level?: string;
  distance?: number;
  elevation?: number;
  homologated?: boolean;
  sourceUrl: string;
  officialUrl?: string;
}

function inferProvince(location: string, source: string): string {
  if (!location) return "valencia";
  const loc = location.toLowerCase();
  const map: Record<string, string> = {
    "valencia": "valencia", "castellón": "castellon", "castelló": "castellon", "alicante": "alicante", "albacete": "albacete",
    "murcia": "murcia", "almería": "almeria", "elche": "alicante", "santa pola": "alicante", "tarragona": "tarragona",
    "cantabria": "cantabria", "asturias": "asturias", "málaga": "malaga", "cáceres": "caceres", "ávila": "avila",
    "huesca": "huesca", "jaén": "jaen", "zaragoza": "zaragoza", "teruel": "teruel", "barcelona": "barcelona",
    "girona": "girona", "lleida": "lleida", "madrid": "madrid", "gipuzkoa": "gipuzkoa", "vizcaya": "vizcaya",
    "navarra": "navarra", "granada": "granada", "córdoba": "cordoba", "sevilla": "sevilla", "huelva": "huelva",
    "cádiz": "cadiz", "alava": "alava", "álava": "alava", "la rioja": "la rioja", "burgos": "burgos",
  };
  for (const [key, value] of Object.entries(map)) {
    if (loc.includes(key)) return value;
  }
  return "valencia"; // fallback
}

function inferRaceType(t: string): "road" | "trail" | "mixed" | "obstacle" {
  if (t === "trail" || t === "mixed" || t === "obstacle") return t;
  return "road";
}

async function main() {
  if (!fs.existsSync(UNIFIED_FILE)) {
    console.error(`❌ No se encontró ${UNIFIED_FILE}.`);
    console.error(`   Ejecuta primero: npm run ingest:all`);
    process.exit(1);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const deployment = process.env.CONVEX_DEPLOYMENT;

  if (!convexUrl || !deployment) {
    console.error(`❌ Convex no está configurado.`);
    console.error(`   Añade a .env.local:`);
    console.error(`     NEXT_PUBLIC_CONVEX_URL=https://tu-proyecto.convex.cloud`);
    console.error(`     CONVEX_DEPLOYMENT=prod:tu-proyecto`);
    console.error(``);
    console.error(`   Alternativa: usa las carreras como mock data con:`);
    console.error(`     npm run ingest:merge-mock`);
    process.exit(1);
  }

  const races: UnifiedRace[] = JSON.parse(fs.readFileSync(UNIFIED_FILE, "utf-8"));
  console.log(`[ingest-to-convex] ${races.length} carreras a subir a Convex...`);

  const client = new ConvexHttpClient(convexUrl);

  let success = 0;
  let failed = 0;

  for (const r of races) {
    try {
      // systemUpsert: idempotente. Si ya existe (mismo officialUrl o
      // mismo nombre+fecha), actualiza los campos vacíos. Si no, crea.
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.location,
        province: inferProvince(r.location, "") as any,
        distanceKm: r.distance ?? (r.type === "trail" ? 21 : 10),
        elevationGainM: r.elevation,
        raceType: inferRaceType(r.type),
        homologated: r.homologated,
        startDate: r.date,
        startTime: "09:00",
        organizer: r.sourceUrl,
        officialUrl: r.officialUrl,
        description: r.modality
          ? `Carrera ${r.modality} de ${r.sourceUrl ? new URL(r.sourceUrl).hostname : "origen oficial"}. ${r.level ? "Nivel: " + r.level + "." : ""}`
          : `Carrera de ${new URL(r.sourceUrl).hostname}.`,
        scraperAdapter: r.sourceUrl ? new URL(r.sourceUrl).hostname.split(".")[0] : undefined,
      });
      success++;
      process.stdout.write(res?.action === "updated" ? "u" : ".");
    } catch (err) {
      failed++;
      console.error(`\n[ingest-to-convex] ❌ Falló "${r.name}":`, err);
    }
  }

  console.log(`\n\n[ingest-to-convex] ✅ ${success} carreras procesadas (created+updated)`);
  if (failed > 0) console.log(`[ingest-to-convex] ⚠️  ${failed} carreras fallaron`);
  console.log(`[ingest-to-convex] Re-ejecuta este script y verás solo "u" (updates) si no hay carreras nuevas.`);
  console.log(`[ingest-to-convex] Verifica en https://dashboard.convex.dev`);
}

main().catch((err) => {
  console.error("[ingest-to-convex] ❌ Error fatal:", err);
  process.exit(1);
});
