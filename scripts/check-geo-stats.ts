// Check stats de geocodificación
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = (await c.query(api.races.systemListAll, {})) as any[];
  const withCoords = r.filter((x: any) => typeof x.latitude === "number" && typeof x.longitude === "number");
  const withoutCoords = r.filter((x: any) => typeof x.latitude !== "number" || typeof x.longitude !== "number");
  console.log("Total:", r.length);
  console.log("Con coordenadas:", withCoords.length);
  console.log("Sin coordenadas:", withoutCoords.length);
  console.log("\nPrimeras 10 SIN coordenadas:");
  withoutCoords.slice(0, 10).forEach((x: any) => {
    console.log(`  - ${x.name} (${x.locality}, ${x.province})`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
