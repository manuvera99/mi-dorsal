import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = (await c.query(api.races.systemListAll, {})) as any[];
  const sin = r.filter((x: any) => x.latitude == null || x.longitude == null);
  console.log("Sin coordenadas:", sin.length);
  sin.forEach((x: any) => console.log(`  ${x.slug} | ${x.name}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
