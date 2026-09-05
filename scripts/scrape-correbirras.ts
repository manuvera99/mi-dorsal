// =============================================================================
// scripts/scrape-correbirras.ts
// =============================================================================
// Scrape la agenda de carreras de correbirras.com.
// Las carreras NO están en el HTML estático — vienen de Supabase REST API
// (la URL y anon key están expuestas en el JS del frontend, así que es
// éticamente scrapeable como cualquier web pública).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/scrape-correbirras.ts          # muestra
//   npx tsx --env-file=.env.local scripts/scrape-correbirras.ts --upload # sube a Convex
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const SUPABASE_URL = "https://kodquqoskqbulqmjdnza.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZHF1cW9za3FidWxxbWpkbnphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTg1NDcsImV4cCI6MjA5MDg5NDU0N30.Ffxz0w4m4g5xzsyOpIbtLsmIrD8B4zbBz_4X-xogUFg";
const SOURCE_URL = "https://www.correbirras.com/Carreras_Agenda.html";
const UPLOAD = process.argv.includes("--upload");

interface CorrebirrasRace {
  id?: number;
  fecha: string;
  edicion?: string;
  nombre: string;
  distancia?: string;
  hora_time?: string;
  hora?: string;
  tipo?: string;
  senderista?: boolean;
  nocturna?: boolean;
  solidaria?: boolean;
  url_web?: string;
  url_ranking?: string;
  url_recorrido?: string;
  localidad?: string;
  ciudad?: string;
  provincia?: string;
  precio_min?: number;
  precio_max?: number;
  eliminada?: boolean;
  [key: string]: any;
}

const TIPO_MAP: Record<string, "road" | "trail" | "mixed" | "obstacle"> = {
  asfalto: "road",
  montaña: "trail",
  montana: "trail",
  mixta: "mixed",
  obstaculos: "obstacle",
};

const PROV_MAP: Record<string, string> = {
  murcia: "murcia",
  alicante: "alicante",
  almeria: "almeria",
  almería: "almeria",
  albacete: "albacete",
};

function parseFecha(s?: string): string | undefined {
  if (!s) return undefined;
  // Supabase devuelve "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM:SS+00:00"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

function parseHora(s?: string): string | undefined {
  if (!s) return undefined;
  // "HH:MM:SS" o "HH:MM"
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
}

function parseDistanciaKm(s?: string): number | undefined {
  if (!s) return undefined;
  const t = s.toLowerCase();
  if (/\bmarat[oó]n\b/.test(t) && !t.includes("media")) return 42.195;
  if (/media\s*marat[oó]n/.test(t)) return 21.0975;
  if (/\bmilla\b/.test(t)) return 1.609;
  // "21K", "10K", "5K", "5 KM"
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*k/i);
  if (m) {
    const n = parseFloat(m[1].replace(",", "."));
    if (n >= 1 && n <= 200) return n;
  }
  return undefined;
}

async function fetchCorrrebirras(): Promise<CorrebirrasRace[]> {
  console.log("Consultando Supabase REST API...");
  // Filtro: solo carreras futuras (fecha >= hoy) y no eliminadas
  const hoy = new Date().toISOString().split("T")[0];
  const url = `${SUPABASE_URL}/rest/v1/carreras?eliminada=eq.false&fecha=gte.${hoy}&order=fecha.asc&limit=500&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as CorrebirrasRace[];
}

async function main() {
  console.log("=".repeat(70));
  console.log("Scrape correbirras.com (vía Supabase REST API)");
  console.log("=".repeat(70));

  const races = await fetchCorrrebirras();
  console.log(`\nCarreras futuras en BBDD de Correbirras: ${races.length}\n`);

  // Mostrar resumen
  const byMonth: Record<string, number> = {};
  const byProv: Record<string, number> = {};
  for (const r of races) {
    const m = (r.fecha ?? "").substring(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + 1;
    const p = (r.provincia ?? "?").toLowerCase();
    byProv[p] = (byProv[p] ?? 0) + 1;
  }
  console.log("Por mes:");
  Object.entries(byMonth).sort().forEach(([m, n]) => console.log(`  ${m}: ${n}`));
  console.log("\nPor provincia:");
  Object.entries(byProv).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${p}: ${n}`));

  console.log("\n" + "─".repeat(70));
  console.log("Listado (primeras 20):\n");
  for (const r of races.slice(0, 20)) {
    const f = parseFecha(r.fecha);
    const h = parseHora(r.hora_time ?? r.hora);
    const km = parseDistanciaKm(r.distancia);
    const tipo = TIPO_MAP[(r.tipo ?? "").toLowerCase()] ?? "road";
    const prov = PROV_MAP[(r.provincia ?? "").toLowerCase()] ?? (r.provincia ?? "").toLowerCase();
    console.log(`${f ?? "?"} ${h ?? ""}  ${(r.nombre ?? "?").padEnd(40)}  ${km ?? "?"}km  ${r.localidad ?? "?"} (${r.provincia ?? "?"})  ${tipo}`);
    if (r.url_web) console.log(`     🔗 ${r.url_web}`);
  }
  if (races.length > 20) {
    console.log(`\n... y ${races.length - 20} más (mostrando solo 20)`);
  }

  if (!UPLOAD) {
    console.log(`\nPara subir a Convex: añade --upload`);
    return;
  }

  // Subir a Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  // Asegurar fuente "correbirras"
  const sources = await client.query(api.dataSources.listPublic, {});
  let cbSrc = sources.find((s: any) => s.slug === "correbirras");
  if (!cbSrc) {
    const id: any = await client.mutation(api.dataSources.systemCreate, {
      name: "Correbirras",
      slug: "correbirras",
      type: "scraper",
      description: "Agenda de carreras populares en Murcia, Alicante, Almería y Albacete",
      baseUrl: "https://www.correbirras.com",
      config: {
        agendaUrl: SOURCE_URL,
        supabaseUrl: SUPABASE_URL,
        scrapedAt: new Date().toISOString(),
      },
    });
    cbSrc = { _id: id } as any;
    console.log("\n✅ Fuente 'correbirras' creada");
  }

  console.log(`\nSubiendo ${races.length} carreras (idempotente)...\n`);
  let created = 0, updated = 0, failed = 0, errors: string[] = [];
  const sourceId = cbSrc!._id;
  for (const r of races) {
    const f = parseFecha(r.fecha);
    const h = parseHora(r.hora_time ?? r.hora);
    const km = parseDistanciaKm(r.distancia);
    const tipo = TIPO_MAP[(r.tipo ?? "").toLowerCase()] ?? "road";
    const prov = PROV_MAP[(r.provincia ?? "").toLowerCase()] ?? "murcia";
    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.nombre,
        locality: r.localidad ?? r.ciudad,
        province: prov as any,
        distanceKm: km ?? 10,
        raceType: tipo,
        startDate: f,
        startTime: h,
        officialUrl: r.url_web ?? SOURCE_URL,
        organizer: "Correbirras",
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "correbirras",
        dataSourceId: sourceId,
      });
      if (res?.action === "created") {
        created++;
        process.stdout.write(".");
      } else {
        updated++;
        process.stdout.write("u");
      }
    } catch (e: any) {
      failed++;
      process.stdout.write("x");
      if (errors.length < 3) errors.push(`${r.nombre}: ${e?.message ?? e}`);
    }
  }
  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas, ${failed} fallaron`);
  if (errors.length) console.log("Errores:", errors);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
