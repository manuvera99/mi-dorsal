import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  const byProv: Record<string, number> = {};
  for (const x of r) {
    const k = x.province ?? "?";
    byProv[k] = (byProv[k] ?? 0) + 1;
  }
  console.log("Distribución por province (después del fix):");
  Object.entries(byProv).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));
  console.log(`\nTotal: ${r.length}`);

  // Cómo quedan los "sin resultado"
  const valenciaSuspects = r.filter((x: any) => x.province === "valencia" && x.locality && x.locality.length >= 2);
  console.log(`\nQuedan con province='valencia': ${valenciaSuspects.length}`);

  // Top localities que siguen en valencia
  const byLoc: Record<string, number> = {};
  for (const x of valenciaSuspects) {
    const k = x.locality;
    byLoc[k] = (byLoc[k] ?? 0) + 1;
  }
  console.log("\nTop 30 localities que siguen en 'valencia':");
  Object.entries(byLoc).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
