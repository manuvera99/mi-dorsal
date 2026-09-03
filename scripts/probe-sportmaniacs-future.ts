// =============================================================================
// scripts/probe-sportmaniacs-future.ts
// =============================================================================
// Verifica en qué página se acaban las carreras futuras.
// =============================================================================

async function main() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`Hoy: ${today}\n`);

  for (const p of [1, 2, 5, 10, 20, 30, 40, 50]) {
    const r = await fetch(`https://api-aws.sportmaniacs.com/api/races?page=${p}&limit=500`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    const data: any = await r.json();
    const future = data.data.filter((x: any) => x.date >= today);
    const futureESP = data.data.filter((x: any) => x.date >= today && x.country_id === "ESP");
    const futureESPRun = data.data.filter((x: any) =>
      x.date >= today && x.country_id === "ESP" && (x.idRaceType === "0" || x.idRaceType === "1")
    );
    const dates = [...new Set(data.data.map((x: any) => x.date))].sort();
    console.log(`Página ${p.toString().padStart(2)}: total=${data.data.length}, future=${future.length}, future-ESP=${futureESP.length}, future-ESP-run=${futureESPRun.length}`);
    console.log(`  Date range: ${dates[0]} → ${dates[dates.length - 1]}`);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
