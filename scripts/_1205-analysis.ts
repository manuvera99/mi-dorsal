import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});

  const valencia = r.filter((x: any) => x.province === "valencia");
  console.log(`Total con province='valencia': ${valencia.length}`);

  // Por fuente
  const bySource: Record<string, number> = {};
  for (const x of valencia) bySource[x.scraperAdapter ?? "?"] = (bySource[x.scraperAdapter ?? "?"] ?? 0) + 1;
  console.log("\nPor scraperAdapter:");
  for (const [k, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${k}`);

  // Por publicada/borrador
  const pub = valencia.filter((x: any) => x.isPublished).length;
  console.log(`\nPublicadas: ${pub}, Borrador: ${valencia.length - pub}`);

  // Con locality vs sin locality
  const withLoc = valencia.filter((x: any) => x.locality && x.locality.length >= 2).length;
  const withoutLoc = valencia.length - withLoc;
  console.log(`Con locality: ${withLoc}, Sin locality (o <2 chars): ${withoutLoc}`);

  // Top localities (top 30)
  const byLoc: Record<string, number> = {};
  for (const x of valencia) {
    if (x.locality && x.locality.length >= 2) {
      const k = x.locality;
      byLoc[k] = (byLoc[k] ?? 0) + 1;
    }
  }
  console.log("\nTop 30 localities en 'valencia' (pueden ser legítimas o no):");
  Object.entries(byLoc).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

  // Localities con caracteres no europeos (sospechosas de fuera de España)
  const nonWestern = valencia.filter((x: any) => {
    const loc = x.locality ?? "";
    // Caracteres cirílicos, polacos, chinos, etc.
    return /[а-яА-ЯёЁąćęłńóśźżĄĆĘŁŃÓŚŹŻ一-鿿]/.test(loc);
  });
  console.log(`\nLocalities con caracteres cirílicos/polacos/chinos: ${nonWestern.length}`);
  for (const x of nonWestern.slice(0, 10)) console.log(`  ${x.name.slice(0, 60)} | ${x.locality}`);

  // Sin locality: cuántas
  const noLoc = valencia.filter((x: any) => !x.locality || x.locality.length < 2);
  console.log(`\nSin locality útil: ${noLoc.length}`);
  for (const x of noLoc.slice(0, 10)) {
    console.log(`  ${x.name.slice(0, 50)} | locality="${x.locality ?? "—"}"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
