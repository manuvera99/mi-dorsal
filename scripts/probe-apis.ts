// =============================================================================
// scripts/probe-apis.ts
// =============================================================================
// Probe en profundidad de APIs escondidas de las fuentes restantes:
//   - RFEA (rfea.es) → ¿tienen API de calendario?
//   - FEDME (fedme.es) → ¿qué post type de WP es "carreras"?
//   - Runedia (mundodeportivo) → ¿tienen JSON en su web?
//   - Sportmaniacs → ya descubierta, verificar params
//   - ITRA → confirmar bloqueo 503
// =============================================================================

interface ProbeResult {
  url: string;
  status: number;
  ct: string;
  size: number;
  preview?: string;
  isJson?: boolean;
  keys?: string;
  dataLen?: number;
  itemKeys?: string;
}

async function probe(
  url: string,
  opts: { headers?: Record<string, string>; label?: string } = {},
): Promise<ProbeResult> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/html, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    ...opts.headers,
  };
  try {
    const res = await fetch(url, { headers });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const isJson = ct.includes("json");
    let keys: string | undefined;
    let dataLen: number | undefined;
    let itemKeys: string | undefined;
    if (isJson) {
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          dataLen = data.length;
          if (data.length) itemKeys = Object.keys(data[0]).join(", ");
        } else if (data && typeof data === "object") {
          keys = Object.keys(data).join(", ");
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
      keys,
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
  console.log(`  ${flag} ${r.status} ${r.url} (${r.size}B, ${r.ct})`);
  if (r.preview) console.log(`      ${r.preview.slice(0, 150)}`);
  if (r.keys) console.log(`      keys: ${r.keys}`);
  if (r.dataLen !== undefined) console.log(`      data[]: ${r.dataLen} items, item keys: ${r.itemKeys}`);
}

// =============== RFEA ===============
async function probeRfea() {
  console.log("\n" + "=".repeat(70));
  console.log("RFEA — Real Federación Española de Atletismo");
  console.log("=".repeat(70));

  // 1) ¿Tienen API?
  const apis = [
    "https://www.rfea.es/api/calendario",
    "https://www.rfea.es/api/v1/calendario",
    "https://www.rfea.es/api/competiciones",
    "https://www.rfea.es/api/races",
    "https://api.rfea.es/calendario",
    "https://calendario.rfea.es/api",
    "https://www.rfea.es/calendario.json",
  ];
  for (const url of apis) show("API", await probe(url));

  // 2) Web principal — buscar scripts y endpoints
  console.log("\n  → HTML principal para encontrar endpoints");
  const main = await probe("https://www.rfea.es/calendario");
  if (main.status === 200) {
    const html = await fetch("https://www.rfea.es/calendario", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());

    // Scripts
    const scripts = [...new Set(
      [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map((m) => m[1])
    )].slice(0, 10);
    console.log(`  Scripts encontrados (${scripts.length}):`);
    scripts.forEach((s) => console.log(`    - ${s}`));

    // Endpoints /api/
    const apiMatches = [...new Set([
      ...(html.match(/['"]\/api\/[a-zA-Z0-9\-_\/.]+['"]/g) ?? []),
      ...(html.match(/https?:\/\/[^"'\s]+\/api\/[a-zA-Z0-9\-_\/.]+/g) ?? []),
    ])].slice(0, 10);
    if (apiMatches.length) {
      console.log(`  Endpoints /api/:`);
      apiMatches.forEach((s) => console.log(`    - ${s}`));
    }

    // URLs ajax / fetch
    const ajax = [...new Set(
      [...html.matchAll(/['"](https?:\/\/[^"'\s]+\.json)['"]/g)].map((m) => m[1])
    )].slice(0, 5);
    if (ajax.length) {
      console.log(`  URLs .json:`);
      ajax.forEach((s) => console.log(`    - ${s}`));
    }
  }

  // 3) Calendario por tipo de prueba
  const subpages = [
    "https://www.rfea.es/calendario/calendario-de-pruebas",
    "https://www.rfea.es/calendario/calendario-de-rutas",
    "https://www.rfea.es/calendario-de-pruebas",
  ];
  for (const url of subpages) {
    const r = await probe(url);
    show("subpage", r);
  }
}

// =============== FEDME ===============
async function probeFedme() {
  console.log("\n" + "=".repeat(70));
  console.log("FEDME — Federación Española Deportes de Montaña");
  console.log("=".repeat(70));

  // 1) Tipos de post de WP
  const types = await probe("https://fedme.es/wp-json/wp/v2/types");
  show("/wp/v2/types", types);

  // 2) Probar todos los tipos que aparecen en el resultado + nombres comunes
  const candidateSlugs = [
    "carrera", "carreras", "competicion", "competiciones",
    "evento", "eventos", "race", "races", "event", "events",
    "prueba", "pruebas", "calendario", "competicion-federada",
  ];
  for (const slug of candidateSlugs) {
    const r = await probe(`https://fedme.es/wp-json/wp/v2/${slug}?per_page=2`);
    if (r.status === 200 && r.isJson) {
      console.log(`  🟢 ${slug} (200, ${r.size}B, data[]: ${r.dataLen}, keys: ${r.itemKeys})`);
      if (r.preview) console.log(`      ${r.preview.slice(0, 250)}`);
    } else if (r.status === 200) {
      console.log(`  🟡 ${slug} (200 pero no JSON, size ${r.size})`);
    } else if (r.status === 404) {
      // Silenciar 404, es esperado
    } else {
      console.log(`  ⚠️ ${slug} (${r.status})`);
    }
  }

  // 3) Buscar en la web un calendario / listado de carreras
  const calPages = [
    "https://fedme.es/calendario/",
    "https://fedme.es/carreras/",
    "https://fedme.es/competiciones/",
    "https://fedme.es/calendario/carreras/",
  ];
  for (const url of calPages) {
    const r = await probe(url);
    show("calendar", r);
  }
}

// =============== Runedia ===============
async function probeRunedia() {
  console.log("\n" + "=".repeat(70));
  console.log("Runedia — Mundo Deportivo");
  console.log("=".repeat(70));

  // 1) ¿Tienen API?
  const apis = [
    "https://runedia.mundodeportivo.com/api/carreras",
    "https://runedia.mundodeportivo.com/api/races",
    "https://runedia.mundodeportivo.com/api/calendario",
    "https://runedia.mundodeportivo.com/api/v1/carreras",
    "https://runedia.mundodeportivo.com/api/events",
    "https://api.runedia.mundodeportivo.com/carreras",
  ];
  for (const url of apis) show("API", await probe(url));

  // 2) HTML principal
  const cal = await probe("https://runedia.mundodeportivo.com/calendario-carreras/");
  show("calendario", cal);
  if (cal.status === 200) {
    const html = await fetch("https://runedia.mundodeportivo.com/calendario-carreras/", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());

    // Scripts
    const scripts = [...new Set(
      [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map((m) => m[1])
    )].slice(0, 10);
    console.log(`  Scripts (${scripts.length}):`);
    scripts.forEach((s) => console.log(`    - ${s}`));

    // Endpoints /api/
    const apiMatches = [...new Set([
      ...(html.match(/['"]\/api\/[a-zA-Z0-9\-_\/.]+['"]/g) ?? []),
      ...(html.match(/https?:\/\/[^"'\s]+\/api\/[a-zA-Z0-9\-_\/.]+/g) ?? []),
    ])].slice(0, 15);
    if (apiMatches.length) {
      console.log(`  Endpoints /api/:`);
      apiMatches.forEach((s) => console.log(`    - ${s}`));
    }

    // Buscar __NEXT_DATA__ o __NUXT__ (Next.js / Nuxt SSR)
    const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
    if (nextData) {
      console.log(`  🟢 __NEXT_DATA__ encontrado (${nextData[1].length} chars)`);
      try {
        const parsed = JSON.parse(nextData[1]);
        const keys = Object.keys(parsed.props ?? {});
        console.log(`      props keys: ${keys.join(", ")}`);
        if (parsed.props?.pageProps) {
          const ppKeys = Object.keys(parsed.props.pageProps);
          console.log(`      pageProps keys: ${ppKeys.join(", ")}`);
          // Buscar arrays de carreras
          for (const k of ppKeys) {
            const v = parsed.props.pageProps[k];
            if (Array.isArray(v) && v.length > 0) {
              console.log(`      pageProps.${k}: array[${v.length}], first keys: ${Object.keys(v[0]).join(", ")}`);
            }
          }
        }
      } catch {}
    }

    const nuxtData = html.match(/<script[^>]*window\.__NUXT__[\s\S]+?<\/script>/);
    if (nuxtData) {
      console.log(`  🟢 __NUXT__ encontrado (${nuxtData[0].length} chars)`);
    }
  }
}

// =============== Sportmaniacs verificación ===============
async function probeSportmaniacsVerify() {
  console.log("\n" + "=".repeat(70));
  console.log("Sportmaniacs — verificación API");
  console.log("=".repeat(70));

  // Probar params que descubrimos
  const endpoints = [
    "https://api-aws.sportmaniacs.com/api/races?limit=3",
    "https://api-aws.sportmaniacs.com/api/races?from=2026-09-01&to=2026-12-31&limit=3",
    "https://api-aws.sportmaniacs.com/api/races/provinces",
    "https://api-aws.sportmaniacs.com/api/races/disciplines",
    "https://api-aws.sportmaniacs.com/api/races?type=trail&limit=3",
    "https://api-aws.sportmaniacs.com/api/races?province=murcia&limit=3",
    "https://api-aws.sportmaniacs.com/api/races?order=date&dir=asc&limit=3",
  ];
  for (const url of endpoints) show("API", await probe(url));
}

// =============== ITRA verificación ===============
async function probeItraVerify() {
  console.log("\n" + "=".repeat(70));
  console.log("ITRA — verificar bloqueo");
  console.log("=".repeat(70));

  const urls = [
    "https://itra.run/Events",
    "https://itra.run/",
    "https://itra.run/api/events",
  ];
  for (const url of urls) show("ITRA", await probe(url));
}

async function main() {
  await probeRfea();
  await probeFedme();
  await probeRunedia();
  await probeSportmaniacsVerify();
  await probeItraVerify();
  console.log("\n✅ Probe completo");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
