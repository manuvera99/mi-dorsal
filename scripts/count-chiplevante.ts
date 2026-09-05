// Cuenta carreras de chiplevante.com en prod
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);
  const all: any[] = await client.query(api.races.systemListAllDetailed, {});
  const chip = all.filter((r) => r.officialUrl?.includes("chiplevante.com"));
  const byProv: Record<string, number> = {};
  const byYear: Record<number, number> = {};
  let futuras = 0;
  const today = new Date().toISOString().split("T")[0];
  for (const r of chip) {
    const p = (r.province ?? "?").toLowerCase();
    byProv[p] = (byProv[p] ?? 0) + 1;
    const y = r.startDate ? parseInt(r.startDate.substring(0, 4), 10) : 0;
    byYear[y] = (byYear[y] ?? 0) + 1;
    if (r.startDate && r.startDate >= today) futuras++;
  }
  console.log("Total carreras chiplevante.com en prod:", chip.length);
  console.log("Futuras:", futuras, "| Pasadas:", chip.length - futuras);
  console.log("\nPor provincia:");
  for (const [p, n] of Object.entries(byProv).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${n}`);
  }
  console.log("\nPor año:");
  for (const [y, n] of Object.entries(byYear).sort()) {
    console.log(`  ${y}: ${n}`);
  }
  console.log("\nPrimeras 5 futuras:");
  for (const r of chip.filter((x) => x.startDate >= today).slice(0, 5)) {
    console.log(`  ${r.startDate}  ${r.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
