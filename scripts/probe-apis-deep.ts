// =============================================================================
// scripts/probe-apis-deep.ts
// =============================================================================
// Segunda ronda: profundizar en leads concretos
//   - RFEA: Drupal REST API
//   - FEDME: The Events Calendar REST API
//   - Runedia: inspección HTML en busca de JSON
//   - Sportmaniacs: province como ID numérico
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
        Accept: "application/json, text/html, */*",
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
      url,
      status: res.status,
      ct: ct.split(";")[0],
      size: text.length,
      preview: text.slice(0, 200).replace(/\s+/g, " "),
      isJson,
      dataLen,
      itemKeys,
    };
  } catch (e: any) {
    return { url, status: 0, ct: "ERR", size: 0, preview: e?.message ?? String(e) };
  }
}

function show(label: string, r: ProbeResult) {
  const flag = r.status === 200 && r.isJson && r.dataLen ? "🟢" :
                r.status === 200 ? "🟡" :
                r.status >= 500 ? "🔴" : "⚪";
  console.log(`  ${flag} ${r.status} ${r.url}`);
  console.log(`      ${r.ct} ${r.size}B  data: ${r.dataLen ?? "—"}  keys: ${r.itemKeys ?? "—"}`);
  if (r.preview) console.log(`      ${r.preview.slice(0, 200)}`);
}

// =============== RFEA Drupal REST ===============
async function probeRfeaDrupal() {
  console.log("\n" + "=".repeat(70));
  console.log("RFEA — Drupal REST API (jsonapi + node)");
  console.log("=".repeat(70));

  const endpoints = [
    "https://www.rfea.es/jsonapi",
    "https://www.rfea.es/jsonapi/node/event",
    "https://www.rfea.es/jsonapi/node/carrera",
    "https://www.rfea.es/jsonapi/node/calendario",
    "https://www.rfea.es/jsonapi/node/competition",
    "https://www.rfea.es/jsonapi/node/race",
    "https://www.rfea.es/jsonapi/node/calendario_de_pruebas",
    "https://www.rfea.es/jsonapi/node/prueba",
    "https://www.rfea.es/jsonapi/node/calendariodepruebas",
    // Drupal node
    "https://www.rfea.es/node?_format=json",
    "https://www.rfea.es/node/1?_format=json",
    // Drupal 8+ REST
    "https://www.rfea.es/entity/node",
    "https://www.rfea.es/rest/views/calendario",
  ];
  for (const url of endpoints) show("RFEA", await probe(url));
}

// =============== FEDME Events Calendar ===============
async function probeFedmeEvents() {
  console.log("\n" + "=".repeat(70));
  console.log("FEDME — The Events Calendar REST API");
  console.log("=".repeat(70));

  // The Events Calendar REST API (community/tec)
  const endpoints = [
    // Plugin v1
    "https://fedme.es/wp-json/tribe/events/v1/events?per_page=5",
    "https://fedme.es/wp-json/tribe/events/v1/events?start_date=2026-09-01&end_date=2026-12-31&per_page=5",
    "https://fedme.es/wp-json/tribe/events/v1/events?categories=14&per_page=5",
    // WP v2 del CPT
    "https://fedme.es/wp-json/wp/v2/tribe_events?per_page=5",
    "https://fedme.es/wp-json/wp/v2/tribe_events?per_page=5&_embed=true",
    "https://fedme.es/wp-json/wp/v2/tribe_venue?per_page=5",
    "https://fedme.es/wp-json/wp/v2/tribe_organizer?per_page=5",
    // Listado de categorías (taxonomías)
    "https://fedme.es/wp-json/wp/v2/categories?per_page=20",
    "https://fedme.es/wp-json/wp/v2/tribe_events_cat?per_page=20",
  ];
  for (const url of endpoints) show("FEDME", await probe(url));
}

// =============== Runedia ===============
async function probeRunediaDeep() {
  console.log("\n" + "=".repeat(70));
  console.log("Runedia — JSON embebido + paginación");
  console.log("=".repeat(70));

  // 1) Página principal → buscar JSON
  const html = await fetch("https://runedia.mundodeportivo.com/calendario-carreras/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  }).then((r) => r.text());

  // Buscar window.__INITIAL_STATE__ o similares
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});/,
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]+?\});/,
    /window\.__DATA__\s*=\s*(\{[\s\S]+?\});/,
    /application\/json["']>\s*(\{[\s\S]+?\})/,
    /<script type="application\/ld\+json">([\s\S]+?)<\/script>/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      console.log(`  🟢 Patrón JSON embebido: ${p.toString().slice(0, 50)}...`);
      console.log(`      ${m[1].slice(0, 300)}`);
    }
  }

  // 2) Parámetros de URL que parezcan paginación o filtro
  const urlParams = [...new Set(
    [...html.matchAll(/[?&]([a-z_]+)=\{?[\w\-_,"':]+/gi)].map((m) => m[1])
  )].slice(0, 30);
  if (urlParams.length) {
    console.log(`  Parámetros URL:`);
    urlParams.forEach((p) => console.log(`    - ${p}`));
  }

  // 3) Endpoints específicos en scripts inline
  const fetchCalls = [...new Set(
    [...html.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1])
  )].slice(0, 20);
  if (fetchCalls.length) {
    console.log(`  fetch() calls:`);
    fetchCalls.forEach((u) => console.log(`    - ${u}`));
  }

  const xhrCalls = [...new Set(
    [...html.matchAll(/\.open\s*\(\s*['"`]GET['"`]\s*,\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1])
  )].slice(0, 20);
  if (xhrCalls.length) {
    console.log(`  XHR GET calls:`);
    xhrCalls.forEach((u) => console.log(`    - ${u}`));
  }

  // 4) Probar paginación típica
  const pagination = [
    "https://runedia.mundodeportivo.com/calendario-carreras/?page=2",
    "https://runedia.mundodeportivo.com/calendario-carreras/pagina-2",
    "https://runedia.mundodeportivo.com/calendario-carreras/page/2",
    "https://runedia.mundodeportivo.com/calendario-carreras/mes/2026-10",
    "https://runedia.mundodeportivo.com/calendario-carreras/provincia/madrid",
  ];
  for (const url of pagination) {
    const r = await probe(url);
    show("pagination", r);
  }
}

// =============== Sportmaniacs province ID ===============
async function probeSportmaniacsIds() {
  console.log("\n" + "=.=.=".repeat(17) + "=");
  console.log("Sportmaniacs — province/discipline IDs");
  console.log("=".repeat(70));

  // Ver el JSON completo de la primera carrera
  const r = await probe("https://api-aws.sportmaniacs.com/api/races?limit=1");
  if (r.status === 200 && r.isJson) {
    const full = await fetch("https://api-aws.sportmaniacs.com/api/races?limit=1", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((res) => res.json());
    if (full.data?.[0]) {
      console.log("  🟢 Primera carrera completa:");
      console.log(JSON.stringify(full.data[0], null, 2));
    }
  }

  // Probar con IDs numéricos en province (Alicante = 3?)
  const provinceIds = [1, 2, 3, 4, 5, 10, 13, 28, 30, 46];
  for (const id of provinceIds) {
    const r = await probe(`https://api-aws.sportmaniacs.com/api/races?province=${id}&limit=1`);
    if (r.status === 200 && r.isJson && r.dataLen && r.dataLen > 0) {
      console.log(`  🟢 province=${id} → ${r.dataLen} items, keys: ${r.itemKeys}`);
    } else {
      console.log(`  ⚪ province=${id} → ${r.dataLen ?? 0} items`);
    }
  }

  // Probar con discipline IDs
  const discIds = [1, 2, 3, 4, 5, 10, 100, 200, "trail", "running", "asphalt"];
  for (const id of discIds) {
    const r = await probe(`https://api-aws.sportmaniacs.com/api/races?idRaceType=${id}&limit=1`);
    if (r.status === 200 && r.isJson && r.dataLen && r.dataLen > 0) {
      console.log(`  🟢 idRaceType=${id} → ${r.dataLen} items, keys: ${r.itemKeys}`);
    }
  }
}

async function main() {
  await probeRfeaDrupal();
  await probeFedmeEvents();
  await probeRunediaDeep();
  await probeSportmaniacsIds();
  console.log("\n✅ Probe profundo completo");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
