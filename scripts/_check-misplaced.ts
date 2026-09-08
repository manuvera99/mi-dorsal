import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});
  const problematic = ["Morocco", "Saltillo", "Tegucigalpa", "Tashkent", "Santo Domingo", "Cancún", "San Luis Potosí", "Los Mochis", "Ciudad de Guatemala", "Villahermosa", "Querétaro", "Port Talbot", "Bogotá", "Reus", "Badajoz", "Jaén", "Madrid", "Sevilla", "Ceuta", "Almeráa", "Roquetas de Mar", "Felanitx", "Ejido (El)"];
  for (const loc of problematic) {
    const m = r.filter((x: any) => x.locality === loc && x.province === "valencia");
    const pub = m.filter((x: any) => x.isPublished).length;
    if (m.length > 0) console.log(`  ${loc.padEnd(25)} ${m.length.toString().padStart(4)} total, ${pub.toString().padStart(4)} publicadas`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
