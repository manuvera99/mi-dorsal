import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  const sm = r.filter((x: any) => x.scraperAdapter === "sportmaniacs");
  const withRacesPlural = sm.filter((x: any) => x.officialUrl && x.officialUrl.startsWith("https://sportmaniacs.com/es/races/") && !x.officialUrl.slice("https://sportmaniacs.com/es/races/".length).includes("/"));
  const withRaceSingular = sm.filter((x: any) => x.officialUrl && x.officialUrl.startsWith("https://sportmaniacs.com/es/race/"));
  const withResults = sm.filter((x: any) => x.officialUrl && x.officialUrl.includes("/results"));
  const withUuid = sm.filter((x: any) => x.officialUrl && /\/[0-9a-f]{8}-/.test(x.officialUrl));
  const withSourceUrl = sm.filter((x: any) => x.sourceUrl && x.sourceUrl.startsWith("https://sportmaniacs.com/es/races/"));
  console.log("Total Sportmaniacs:", sm.length);
  console.log("  /es/races/{slug} (BIEN, plural canónico):", withRacesPlural.length);
  console.log("  /es/race/  (singular, MAL):", withRaceSingular.length);
  console.log("  con /results (MAL):", withResults.length);
  console.log("  con UUID   (MAL):", withUuid.length);
  console.log("  sourceUrl en /es/races/:", withSourceUrl.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
