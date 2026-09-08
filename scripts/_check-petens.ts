import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  // Buscar las de Petén/Guatemala
  const peten = r.filter((x: any) => /pet[ée]n|tikal|guatemala/i.test(x.name));
  console.log("Carreras de Petén/Guatemala en DB:");
  for (const s of peten) {
    console.log(`  ${s.name.slice(0, 50)} | province=${s.province} | locality=${s.locality} | isPublished=${s.isPublished}`);
  }

  // Buscar SEMI MARATHON FNIDEQ que mencionaste
  const fnideq = r.filter((x: any) => /fnideq/i.test(x.name));
  console.log("\nCarreras con 'FNIDEQ' en el nombre:");
  for (const s of fnideq) {
    console.log(`  ${s.startDate}  ${s.name}`);
    console.log(`    province=${s.province}  locality=${s.locality}`);
  }

  // Buscar las carreras de Tashkent (la de "New Year" debería estar entre las 12)
  const tashkentAll = r.filter((x: any) => /tashkent/i.test(x.name) || /tashk/i.test(x.locality ?? ""));
  console.log(`\nTodas las Tashkent (incluyendo locality): ${tashkentAll.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
