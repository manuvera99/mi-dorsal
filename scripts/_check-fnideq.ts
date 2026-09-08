import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  const fn = r.filter((x: any) => /fnideq/i.test(x.name) || /fnideq/i.test(x.locality ?? ""));
  console.log("Carreras con FNIDEQ:");
  for (const s of fn) {
    console.log(`  ${s.startDate}  ${s.name}`);
    console.log(`    province=${s.province}  locality=${s.locality}  isPublished=${s.isPublished}`);
    console.log(`    URL: ${s.officialUrl}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
