// Check status del bulk deep extract
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, { onlyWithOfficialUrl: true });
  const extracted = r.filter((x: any) => x.extractedAt);
  const notExtracted = r.filter((x: any) => !x.extractedAt);
  console.log("Con extractedAt:", extracted.length, "/", r.length);
  console.log("Sin extraer:", notExtracted.length);

  // Cuántas tienen longDescription / altimetryData / raceFormats
  const withLongDesc = r.filter((x: any) => x.longDescription).length;
  const withAltimetry = r.filter((x: any) => x.altimetryData && x.altimetryData.length > 0).length;
  const withFormats = r.filter((x: any) => x.raceFormats && x.raceFormats.length > 0).length;
  console.log("Con longDescription:", withLongDesc);
  console.log("Con altimetryData:", withAltimetry);
  console.log("Con raceFormats:", withFormats);
}

main().catch((e) => { console.error(e); process.exit(1); });
