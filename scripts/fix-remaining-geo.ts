// =============================================================================
// scripts/fix-remaining-geo.ts
// =============================================================================
// Geocodifica manualmente las carreras que fallaron con la query por defecto.
// Usa queries alternativas más específicas para evitar problemas de
// ambigüedad (ej. Medellín en Colombia vs Badajoz).
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "mi-dorsal/1.0 (https://mi-dorsal.vercel.app; manu@mi-dorsal.app)";
const DELAY_MS = 1100;

// (slug, queries alternativas en orden de prioridad, lat/lng manual fallback)
const MANUAL_FIXES: Array<{
  slugMatch: string; // substring del slug
  queries: string[];
  manual?: { lat: number; lng: number; name: string };
}> = [
  {
    slugMatch: "circuito-de-nochevieja-memorial-ramon-gil",
    queries: [
      "Galdakao, Bizkaia, España",
      "Galdakao, Vizcaya, España",
    ],
  },
  {
    slugMatch: "xi-adobe-sant-carles-trail",
    queries: [
      "Santa Eulària des Riu, Baleares, España",
      "Santa Eulalia del Rio, Ibiza, España",
    ],
  },
  {
    slugMatch: "xiii-kdd-btt-torreon-de-cuadros",
    queries: [
      "Bedmar, Jaén, España",
      "Bedmar y Garcíez, Jaén, España",
    ],
  },
  {
    slugMatch: "carrera-generacion-igualdad-medellin",
    queries: [
      "Medellín, Badajoz, Extremadura, España",
      "Don Benito, Badajoz, España", // Medellín está al lado de Don Benito
    ],
  },
  {
    slugMatch: "xiii-edicio-curses-serra-de-tramuntana-2026",
    queries: [
      "Banyalbufar, Mallorca, Baleares, España",
      "Banyalbufar, Spain",
    ],
    // Fallback manual si Nominatim no encuentra (coordenadas del pueblo)
    manual: { lat: 39.6853, lng: 2.5119, name: "Banyalbufar (manual fallback)" },
  },
];

async function geocode(query: string): Promise<{ lat: number; lon: number; display_name: string } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
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
  console.log("Fix manual de 5 carreras que fallaron la geocodificación auto");
  console.log("=".repeat(70));

  const all = (await client.query(api.races.systemListAll, {})) as any[];
  const withoutCoords = all.filter(
    (x: any) => typeof x.latitude !== "number" || typeof x.longitude !== "number"
  );
  console.log(`\nCarreras sin coordenadas: ${withoutCoords.length}`);

  let success = 0;
  let failed = 0;

  for (const r of withoutCoords) {
    const fix = MANUAL_FIXES.find((f) => r.slug.includes(f.slugMatch));
    if (!fix) {
      console.log(`\n⚠️  ${r.name} (${r.slug}) — no tiene fix manual definido, saltando`);
      failed++;
      continue;
    }

    console.log(`\n[${r.name}]`);
    console.log(`  Locality: ${r.locality}, Province: ${r.province}`);

    let applied = false;
    for (const query of fix.queries) {
      console.log(`  Probando: "${query}"`);
      const result = await geocode(query);
      if (result) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        if (isFinite(lat) && isFinite(lng)) {
          await client.mutation(api.races.systemUpdate, {
            id: r._id,
            patch: { latitude: lat, longitude: lng },
          });
          console.log(`  ✅ ${lat.toFixed(4)}, ${lng.toFixed(4)} — ${result.display_name.slice(0, 80)}`);
          success++;
          applied = true;
          break;
        }
      }
      await sleep(DELAY_MS);
    }

    if (!applied && fix.manual) {
      console.log(`  ⚠️  Nominatim falló, usando coordenadas manuales: ${fix.manual.name}`);
      await client.mutation(api.races.systemUpdate, {
        id: r._id,
        patch: { latitude: fix.manual.lat, longitude: fix.manual.lng },
      });
      console.log(`  ✅ ${fix.manual.lat}, ${fix.manual.lng} (manual)`);
      success++;
    } else if (!applied) {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`✅ ${success} geocodificadas, ❌ ${failed} siguen pendientes`);
  console.log("=".repeat(70));
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
