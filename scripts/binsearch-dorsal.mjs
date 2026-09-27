// Binsearch del dorsal 8780 en el API de Sportmaniacs para la 15K Nocturna.
const EVENT = "6ab84d60-f540-4c1c-bee8-40b1ac1f0614";
const DORSAL = "8780";
const UA = "Mozilla/5.0 mi-dorsal/0.1";
const BASE = "https://sportmaniacs.com/es/api/rankings";

async function probe(page) {
  const r = await fetch(`${BASE}?event=${EVENT}&page=${page}`, {
    headers: { Accept: "application/json", "User-Agent": UA, "X-Requested-With": "XMLHttpRequest" },
  });
  const body = await r.json();
  if (body.status !== "ok") return { status: "ko", data: [] };
  return { status: "ok", data: body.data };
}

async function main() {
  // 1) Encontrar la última página válida (la más alta con data).
  let lo = 1, hi = 500;
  console.log(`Probando ${lo}..${hi}...`);
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const r = await probe(mid);
    if (r.status === "ok") {
      lo = mid;
    } else {
      hi = mid - 1;
    }
    process.stdout.write(`mid=${mid} (${r.status}) lo=${lo} hi=${hi}\r`);
  }
  process.stdout.write("\n");
  console.log(`Última página válida: ${lo}`);

  // 2) Iterar todas las páginas válidas y buscar el dorsal.
  for (let p = 1; p <= lo; p++) {
    const r = await probe(p);
    if (r.status !== "ok") {
      console.log(`page ${p}: ko, skipping`);
      continue;
    }
    const hit = r.data.find((row) => row.dorsal === DORSAL);
    if (hit) {
      console.log(`\nFOUND on page ${p}:`);
      console.log(JSON.stringify(hit, null, 2));
      return;
    }
    if (p % 20 === 0) console.log(`page ${p}...`);
  }
  console.log(`Dorsal ${DORSAL} no aparece en ${lo} páginas.`);
}
main().catch((e) => console.error("ERROR:", e));
