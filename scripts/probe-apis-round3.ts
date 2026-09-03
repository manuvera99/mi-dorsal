// =============================================================================
// scripts/probe-apis-round3.ts
// =============================================================================
// Ronda 3 — probar leads concretos
//   - Sportmaniacs: rango total de carreras (paginar bien)
//   - RFEA: feeds RSS / XML / JSON
//   - FEDME: tribe_events con event_category
//   - Runedia: filtros URL fechaIni/fechaFi/ccaa
// =============================================================================

interface ProbeResult {
  url: string;
  status: number;
  ct: string;
  size: number;
  preview?: string;
  isJson?: boolean;
  dataLen?: number;
  itemKeys?: string;
}

async function probe(url: string, headers: Record<string, string> = {}): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/html, application/xml, */*",
        ...headers,
      },
    });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const isJson = ct.includes("json");
    let dataLen: number | undefined;
    let itemKeys: string | undefined;
    if (isJson) {
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          dataLen = data.length;
          if (data.length) itemKeys = Object.keys(data[0]).join(", ");
        } else if (data && typeof data === "object") {
          if (Array.isArray((data as any).data)) {
            dataLen = (data as any).data.length;
            if (dataLen > 0) itemKeys = Object.keys((data as any).data[0]).join(", ");
          }
        }
      } catch {}
    }
    return {
      url, status: res.status, ct: ct.split(";")[0], size: text.length,
      preview: text.slice(0, 200).replace(/\s+/g, " "), isJson, dataLen, itemKeys,
    };
  } catch (e: any) {
    return { url, status: 0, ct: "ERR", size: 0, preview: e?.message ?? String(e) };
  }
}

function show(label: string, r: ProbeResult) {
  const flag = r.status === 200 && r.isJson && r.dataLen ? "🟢" :
                r.status === 200 ? "🟡" :
                r.status >= 500 ? "🔴" : "⚪";
  console.log(`  ${flag} ${r.status} ${r.url} (${r.size}B, ${r.ct})`);
  if (r.preview) console.log(`      ${r.preview.slice(0, 200)}`);
  if (r.dataLen !== undefined) console.log(`      data: ${r.dataLen} items, keys: ${r.itemKeys}`);
}

// =============== Sportmaniacs: total real ===============
async function probeSportmaniacsTotal() {
  console.log("\n" + "=".repeat(70));
  console.log("Sportmaniacs — total de carreras y paginación");
  console.log("=".repeat(70));

  // Probar limit alto + ver totalPages
  for (const limit of [10, 50, 100, 500]) {
    const r = await probe(`https://api-aws.sportmaniacs.com/api/races?limit=${limit}`);
    console.log(`  ${r.status} limit=${limit} (${r.size}B, data: ${r.dataLen})`);
    if (r.isJson) {
      const data = await fetch(`https://api-aws.sportmaniacs.com/api/races?limit=${limit}`).then((res) => res.json());
      console.log(`      totalPages: ${data.totalPages}, pastPages: ${data.pastPages}, futurePages: ${data.futurePages}, status: ${data.status}`);
    }
  }

  // Rango de fechas: todo 2026
  for (const range of [
    { from: "2026-01-01", to: "2026-12-31" },
    { from: "2026-09-01", to: "2026-12-31" },
    { from: "2026-09-03", to: "2027-09-03" },
  ]) {
    const r = await probe(`https://api-aws.sportmaniacs.com/api/races?from=${range.from}&to=${range.to}&limit=10`);
    console.log(`  ${r.status} from=${range.from}&to=${range.to} (${r.size}B, data: ${r.dataLen})`);
    if (r.isJson) {
      const data = await fetch(`https://api-aws.sportmaniacs.com/api/races?from=${range.from}&to=${range.to}&limit=10`).then((res) => res.json());
      console.log(`      totalPages: ${data.totalPages}, past: ${data.pastPages}, future: ${data.futurePages}`);
    }
  }

  // Probar page=2, 5, 10
  for (const page of [2, 5, 10, 50]) {
    const r = await probe(`https://api-aws.sportmaniacs.com/api/races?page=${page}&limit=3`);
    console.log(`  ${r.status} page=${page} (${r.size}B, data: ${r.dataLen})`);
  }

  // Ver TODOS los idRaceType únicos en la primera página
  console.log("\n  Tipos de carrera en la primera página:");
  const all = await fetch("https://api-aws.sportmaniacs.com/api/races?limit=100").then((res) => res.json());
  const types = new Set<string>();
  for (const r of all.data ?? []) types.add(String(r.idRaceType));
  console.log(`      idRaceType únicos: ${[...types].join(", ")}`);
}

// =============== RFEA feeds ===============
async function probeRfeaFeeds() {
  console.log("\n" + "=".repeat(70));
  console.log("RFEA — Feeds RSS / Atom / XML / JSON");
  console.log("=".repeat(70));

  const feeds = [
    "https://www.rfea.es/calendario/rss.xml",
    "https://www.rfea.es/calendario/feed",
    "https://www.rfea.es/calendario/calendario-de-pruebas/rss.xml",
    "https://www.rfea.es/calendario/calendario-de-pruebas/feed",
    "https://www.rfea.es/calendario/calendario-de-rutas/rss.xml",
    "https://www.rfea.es/calendario/calendario-de-rutas/feed",
    "https://www.rfea.es/rss.xml",
    "https://www.rfea.es/feed",
    "https://www.rfea.es/calendario/calendario-de-pruebas?_format=json",
    "https://www.rfea.es/calendario/calendario-de-rutas?_format=json",
    "https://www.rfea.es/calendario?_format=json",
  ];
  for (const url of feeds) show("RFEA feed", await probe(url));

  // Probar sitemap
  console.log("\n  Sitemaps:");
  const sitemaps = [
    "https://www.rfea.es/sitemap.xml",
    "https://www.rfea.es/sitemap_index.xml",
    "https://www.rfea.es/calendario/sitemap.xml",
  ];
  for (const url of sitemaps) show("Sitemap", await probe(url));
}

// =============== FEDME tribe_events con categorías ===============
async function probeFedmeCategories() {
  console.log("\n" + "=".repeat(70));
  console.log("FEDME — tribe_events con filtro de categoría");
  console.log("=".repeat(70));

  // Categoría 764 = Carreras por Montaña (count 11)
  // Probar varios formatos de filter
  const filters = [
    "https://fedme.es/wp-json/tribe/events/v1/events?categories%5B%5D=764&per_page=20",
    "https://fedme.es/wp-json/tribe/events/v1/events?event_category=764&per_page=20",
    "https://fedme.es/wp-json/tribe/events/v1/events?eventCategory=764&per_page=20",
    "https://fedme.es/wp-json/tribe/events/v1/events?eventDisplay=upcoming&per_page=20",
    "https://fedme.es/wp-json/tribe/events/v1/events?eventDisplay=custom&start_date=2026-01-01&end_date=2026-12-31&per_page=20",
    "https://fedme.es/wp-json/tribe/events/v1/events?featured=true&per_page=20",
  ];
  for (const url of filters) show("FEDME filter", await probe(url));

  // Ver todos los términos tribe_events_cat
  console.log("\n  Todas las tribe_events_cat:");
  const cats = await fetch("https://fedme.es/wp-json/wp/v2/tribe_events_cat?per_page=100").then((r) => r.json());
  if (Array.isArray(cats)) {
    cats.forEach((c: any) => console.log(`      id=${c.id} "${c.name}" (slug: ${c.slug}, count: ${c.count})`));
  }
}

// =============== Runedia: filtros URL ===============
async function probeRunediaFilters() {
  console.log("\n" + "=".repeat(70));
  console.log("Runedia — filtros con parámetros URL");
  console.log("=".repeat(70));

  const filters = [
    "https://runedia.mundodeportivo.com/calendario-carreras/?fechaIni=2026-09-01&fechaFi=2026-12-31",
    "https://runedia.mundodeportivo.com/calendario-carreras/?pais=es",
    "https://runedia.mundodeportivo.com/calendario-carreras/?ccaa=valencia",
    "https://runedia.mundodeportivo.com/calendario-carreras/?pais=es&ccaa=murcia",
    "https://runedia.mundodeportivo.com/calendario-carreras/?funcion=listado",
    "https://runedia.mundodeportivo.com/calendario-carreras/?id=1",
    "https://runedia.mundodeportivo.com/calendario-carreras/?ver=tarjeta",
  ];
  for (const url of filters) show("Runedia", await probe(url));

  // Probar AJAX endpoint común
  const ajax = [
    "https://runedia.mundodeportivo.com/calendario-carreras/ajax",
    "https://runedia.mundodeportivo.com/ajax/calendario",
    "https://runedia.mundodeportivo.com/api/calendario",
    "https://runedia.mundodeportivo.com/calendario/calendario-carreras",
  ];
  for (const url of ajax) show("Runedia AJAX", await probe(url));
}

async function main() {
  await probeSportmaniacsTotal();
  await probeRfeaFeeds();
  await probeFedmeCategories();
  await probeRunediaFilters();
  console.log("\n✅ Probe round 3 completo");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
