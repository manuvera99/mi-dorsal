// Smoke test del parser de URL del adapter chiplevante
import { parseChiplevanteUrl } from "../convex/scraper";

const tests = [
  "https://www.chiplevante.com/es/prueba/cross-de-carrus-402-2026",
  "https://www.chiplevante.com/es/prueba/10-km-y-5-km-villa-de-rojales-22-2026",
  "https://www.chiplevante.com/es/prueba/las-tres-leguas-de-villamalea-62-2026",
  "https://www.chiplevante.com/es/prueba/carrera-de-la-mujer-elche-1156-2026",
  "https://www.chiplevante.com/es/prueba/cross-de-carrus-402-2026/",
  "https://www.chiplevante.com/es",
  "https://example.com/foo",
  "https://www.chiplevante.com/es/prueba/ultra-helike-22-2026", // slug con "22" parecido a id
];

let pass = 0;
let fail = 0;
for (const u of tests) {
  const r = parseChiplevanteUrl(u);
  console.log(`${r ? "✓" : "✗"}  ${u.padEnd(80)}  →  ${JSON.stringify(r)}`);
  if (r) pass++;
  else fail++;
}
console.log(`\n${pass} OK, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
