import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const all: any[] = await client.query(api.races.systemListAllDetailed, {} as any);
  const cb = all.filter((r) => r.scraperAdapter === "correbirras");

  console.log("=".repeat(70));
  console.log(`Carreras de Correbirras en BBDD: ${cb.length}`);
  console.log("=".repeat(70));

  // Agrupar por mes
  const byMonth: Record<string, number> = {};
  const byProv: Record<string, number> = {};
  for (const r of cb) {
    const m = (r.startDate ?? "").substring(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + 1;
    byProv[r.province] = (byProv[r.province] ?? 0) + 1;
  }

  console.log("\nPor mes:");
  Object.entries(byMonth).sort().forEach(([m, n]) => console.log(`  ${m}: ${n}`));

  console.log("\nPor provincia:");
  Object.entries(byProv).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${p}: ${n}`));

  console.log("\nPrimeras 10 con URL:");
  for (const r of cb.slice(0, 10)) {
    console.log(`  ${r.startDate} ${r.name}`);
    console.log(`     /carreras/${r.slug}`);
    console.log(`     🔗 ${r.officialUrl}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
