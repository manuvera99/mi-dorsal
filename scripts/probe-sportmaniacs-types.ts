// =============================================================================
// scripts/probe-sportmaniacs-types.ts
// =============================================================================
// Samplea carreras de Sportmaniacs para mapear idRaceType → tipo y ver
// las provincias reales que devuelven.
// =============================================================================

async function main() {
  const r = await fetch("https://api-aws.sportmaniacs.com/api/races?limit=1000", {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data: any = await r.json();
  console.log(`Total carreras reportadas: ${data.totalPages * 1000} (aprox, ${data.data.length} en este sample)`);

  // Mapear idRaceType → qué nombre aparece
  const types: Record<string, Set<string>> = {};
  const provinces: Record<string, number> = {};
  const countries: Record<string, number> = {};
  for (const race of data.data) {
    const t = String(race.idRaceType ?? "?");
    if (!types[t]) types[t] = new Set();
    types[t].add(race.name);
    const p = (race.province ?? "?").toLowerCase().trim();
    provinces[p] = (provinces[p] ?? 0) + 1;
    const c = race.country ?? "?";
    countries[c] = (countries[c] ?? 0) + 1;
  }
  console.log("\nTipos de carrera (idRaceType → ejemplos de nombre):");
  for (const [k, v] of Object.entries(types).sort()) {
    const examples = [...v].slice(0, 3).join(" | ");
    console.log(`  ${k}: ${examples}`);
  }
  console.log(`\nPaíses (top 10):`);
  Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${v} → ${k}`));
  console.log(`\nProvincias (top 30):`);
  Object.entries(provinces).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(`  ${v} → ${k}`));
  console.log(`\nTotal provincias únicas: ${Object.keys(provinces).length}`);
  console.log(`Total países únicos: ${Object.keys(countries).length}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
