// =============================================================================
// scripts/geocode-races.ts
// =============================================================================
// Geocodifica las carreras usando Nominatim (OpenStreetMap, gratis, sin key).
//
// Para cada carrera sin lat/lng, busca "${locality}, ${province}, España"
// y guarda la primera coincidencia.
//
// Rate limit: 1 req/seg (Nominatim ToS).
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "mi-dorsal/1.0 (https://mi-dorsal.vercel.app; manu@mi-dorsal.app)"; // Nominatim pide user-agent identificable
const DELAY_MS = 1100; // 1.1s entre requests (Nominatim ToS)
const ONLY_MISSING = process.argv.includes("--only-missing");

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
}

async function geocode(query: string): Promise<NominatimResult | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
  });
  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }
  const data = (await res.json()) as NominatimResult[];
  return data[0] ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  console.log("=".repeat(70));
  console.log("Geocodificación de carreras con Nominatim (OpenStreetMap)");
  console.log("=".repeat(70));
  console.log("Flags:", { onlyMissing: ONLY_MISSING, delayMs: DELAY_MS });
  console.log("");

  // Necesitamos TODOS los campos (incluida locality y province) para geocodificar
  // pero systemListAll solo devuelve 6. Vamos a usar un query nuevo o ampliar.
  // Solución: usamos un sistema con systemListAllDetailed si existe, o paginamos.
  // Para simplificar, hacemos un query custom via api que devuelva locality/province.
  // Si no existe, hacemos el bucle con systemListAll (que ya devuelve locality en version nueva).
  // Usaremos el nuevo query systemListAll que añadimos antes.

  // systemListAll devuelve locality, startDate, etc. Vamos a usarlo.
  const all = (await client.query(api.races.systemListAll, {})) as any[];
  console.log(`Total carreras: ${all.length}`);

  let toProcess = all;
  if (ONLY_MISSING) {
    toProcess = toProcess.filter((r: any) => r.latitude == null || r.longitude == null);
    console.log(`Solo sin coordenadas: ${toProcess.length}`);
  }

  if (toProcess.length === 0) {
    console.log("Nada que geocodificar.");
    return;
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const r = toProcess[i];
    const pct = ((i + 1) / toProcess.length * 100).toFixed(0);
    // Construir query: locality + province + España
    const query = [r.locality, r.province, "España"].filter(Boolean).join(", ");
    if (!query) {
      failed++;
      continue;
    }

    process.stdout.write(`\n[${i + 1}/${toProcess.length} ${pct}%] ${r.name} (${r.slug})\n  ↳ query: "${query}"\n`);

    try {
      const result = await geocode(query);
      if (!result) {
        console.log(`  ⚠️  Sin resultados`);
        failed++;
        continue;
      }
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      if (!isFinite(lat) || !isFinite(lng)) {
        console.log(`  ⚠️  Lat/lng inválidos: ${result.lat}, ${result.lon}`);
        failed++;
        continue;
      }
      // Aplicar via systemUpdate
      await client.mutation(api.races.systemUpdate, {
        id: r._id,
        patch: { latitude: lat, longitude: lng },
      });
      console.log(`  ✅ ${lat.toFixed(4)}, ${lng.toFixed(4)} — ${result.display_name.slice(0, 80)}`);
      success++;
    } catch (e: any) {
      console.error(`  ❌ ${e?.message ?? e}`);
      failed++;
      if (errors.length < 3) errors.push(`${r.name}: ${e?.message ?? e}`);
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS);
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`✅ ${success} geocodificadas`);
  console.log(`❌ ${failed} fallaron`);
  if (errors.length) console.log("Errores:", errors);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
