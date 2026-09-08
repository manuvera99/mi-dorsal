import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  const t = r.filter((x: any) => /tashkent|uzbek|new year marathon/i.test(x.name));
  console.log(`Carreras con "tashkent"/"uzbek"/"new year marathon": ${t.length}`);
  for (const x of t) {
    console.log(`\n  Nombre:   ${x.name}`);
    console.log(`  Fecha:    ${x.startDate}`);
    console.log(`  Province: ${x.province}`);
    console.log(`  Locality: ${x.locality}`);
    console.log(`  officialUrl: ${x.officialUrl}`);
    console.log(`  sourceUrl:   ${x.sourceUrl}`);
    console.log(`  scraperAdapter: ${x.scraperAdapter}`);
    console.log(`  lat/lng: ${x.latitude}/${x.longitude}`);
  }

  // También busqueda más amplia por "Tashkent"
  const t2 = r.filter((x: any) => /tashk/i.test(x.name) || /tashk/i.test(x.locality ?? ""));
  console.log(`\nCualquier coincidencia con "tashk": ${t2.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
