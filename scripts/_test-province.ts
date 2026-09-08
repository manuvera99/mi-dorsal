import { geocode, extractProvince } from "./fix-province-from-geo";

async function main() {
  const tests = ["Sabadell", "Santa Cruz de Tenerife", "Castalla", "Galdakao", "Faura", "Alcàsser", "Quart de les Valls", "Olleria (l')"];
  for (const t of tests) {
    const r = await geocode(`${t}, España`);
    if (!r) { console.log(`  ${t} → sin resultado`); continue; }
    const p = extractProvince(r.address);
    console.log(`  ${t.padEnd(30)} → ${p ?? "?"}  (${r.address?.state_district}/${r.address?.state})`);
  }
}
main().catch(console.error);
