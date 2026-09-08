import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  const sm = r.filter((x: any) => x.scraperAdapter === "sportmaniacs");

  // Por provincia
  const byProv: Record<string, number> = {};
  for (const x of sm) byProv[x.province ?? "?"] = (byProv[x.province ?? "?"] ?? 0) + 1;
  console.log("Por provincia (todas las de Sportmaniacs):");
  Object.entries(byProv).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

  // Por tipo
  const byType: Record<string, number> = {};
  for (const x of sm) byType[x.raceType ?? "?"] = (byType[x.raceType ?? "?"] ?? 0) + 1;
  console.log("\nPor tipo:");
  Object.entries(byType).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

  // Por año-mes (próximas)
  const today = new Date().toISOString().slice(0, 10);
  const future = sm.filter((x: any) => (x.startDate ?? "") >= today);
  const past = sm.filter((x: any) => (x.startDate ?? "") < today);
  console.log(`\nFuturas: ${future.length}, Pasadas: ${past.length}`);

  const byMonth: Record<string, number> = {};
  for (const x of future) {
    const ym = (x.startDate ?? "?").slice(0, 7);
    byMonth[ym] = (byMonth[ym] ?? 0) + 1;
  }
  console.log("\nFuturas por mes:");
  Object.entries(byMonth).sort().slice(0, 12).forEach(([k, n]) => console.log(`  ${k}: ${n}`));

  // Publicadas vs borrador
  const published = sm.filter((x: any) => x.isPublished);
  const drafts = sm.filter((x: any) => !x.isPublished);
  console.log(`\nPublicadas: ${published.length}, Borrador: ${drafts.length}`);

  // Con geo vs sin geo
  const withGeo = sm.filter((x: any) => typeof x.latitude === "number" && typeof x.longitude === "number");
  console.log(`Con lat/lng: ${withGeo.length}, sin lat/lng: ${sm.length - withGeo.length}`);

  // Muestra 5 aleatorias
  console.log("\nMuestra 5 carreras (publicadas y futuras):");
  for (const x of future.filter((x: any) => x.isPublished).slice(0, 5)) {
    console.log(`  ${x.startDate}  ${x.name}`);
    console.log(`    ${x.locality} (${x.province}) | ${x.raceType}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
