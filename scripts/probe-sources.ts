// =============================================================================
// scripts/probe-sources.ts
// =============================================================================
// Probe específico por fuente:
//   - FEDME: WordPress REST API en /wp-json/wp/v2/
//   - ITRA: probar con diferentes user agents
//   - Sportmaniacs: encontrar endpoints de la SPA
//   - Runedia: calendario
// =============================================================================

async function probeFedme() {
  console.log("\n" + "=".repeat(70));
  console.log("FEDME — WordPress REST API");
  console.log("=".repeat(70));

  const apis = [
    "https://fedme.es/wp-json/",
    "https://fedme.es/wp-json/wp/v2/posts?per_page=10&search=carrera",
    "https://fedme.es/wp-json/wp/v2/carreras?per_page=20",
    "https://fedme.es/wp-json/wp/v2/eventos?per_page=20",
    "https://fedme.es/wp-json/wp/v2/types",
  ];

  for (const url of apis) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; mi-dorsal/1.0)",
          Accept: "application/json",
        },
      });
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      const preview = text.slice(0, 250);
      console.log(`  ${res.status} ${url}`);
      console.log(`    CT: ${ct.split(";")[0]}, size: ${text.length}`);
      console.log(`    Preview: ${preview.replace(/\s+/g, " ")}...`);
    } catch (e: any) {
      console.log(`  ❌ ${url} → ${e?.message ?? e}`);
    }
  }
}

async function probeItra() {
  console.log("\n" + "=".repeat(70));
  console.log("ITRA — Probar diferentes approaches");
  console.log("=".repeat(70));

  const endpoints = [
    "https://itra.run/Events",
    "https://itra.run/Events/",
    "https://itra.run/api/Events",
    "https://itra.run/api/v1/Events",
    "https://itra.run/Races/FindARace",
    "https://itra.run/Races/Upcoming",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/json,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      console.log(`  ${res.status} ${url}`);
      console.log(`    CT: ${ct.split(";")[0]}, size: ${text.length}`);
      if (res.status === 200) {
        console.log(`    Preview: ${text.slice(0, 150).replace(/\s+/g, " ")}...`);
      }
    } catch (e: any) {
      console.log(`  ❌ ${url} → ${e?.message ?? e}`);
    }
  }
}

async function probeSportmaniacs() {
  console.log("\n" + "=".repeat(70));
  console.log("Sportmaniacs — buscar SPA endpoints");
  console.log("=".repeat(70));

  const res = await fetch("https://sportmaniacs.com", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  const html = await res.text();
  console.log(`  HTML size: ${html.length}`);

  // Buscar scripts
  const scripts: string[] = [];
  const re = /<script[^>]*src=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    scripts.push(m[1]);
  }
  console.log(`  Scripts (${scripts.length}):`);
  scripts.slice(0, 10).forEach((s) => console.log(`    - ${s}`));

  // Buscar endpoints API en el HTML
  const apiMatches = [...new Set([
    ...(html.match(/['"]\/api\/[a-zA-Z0-9\-_\/]+['"]/g) ?? []),
    ...(html.match(/https?:\/\/[^"'\s]+\/api\/[a-zA-Z0-9\-_\/]+/g) ?? []),
  ])].slice(0, 10);
  if (apiMatches.length) {
    console.log(`  Endpoints API:`);
    apiMatches.forEach((s) => console.log(`    - ${s}`));
  }

  // Buscar variable window.X
  const wMatches = [...new Set(html.match(/window\.[A-Z_][A-Z0-9_]*\s*=\s*\{/g) ?? [])];
  if (wMatches.length) {
    console.log(`  window globals:`);
    wMatches.slice(0, 5).forEach((s) => console.log(`    - ${s}`));
  }

  // Probar endpoints comunes
  console.log(`  Probando endpoints comunes:`);
  const candidates = [
    "https://sportmaniacs.com/api/races",
    "https://sportmaniacs.com/api/v1/races",
    "https://sportmaniacs.com/api/calendar",
    "https://sportmaniacs.com/api/events",
    "https://sportmaniacs.com/api/carreras",
  ];
  for (const c of candidates) {
    try {
      const r = await fetch(c, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      const ct = r.headers.get("content-type") ?? "";
      console.log(`    ${r.status} ${c} (CT: ${ct.split(";")[0]})`);
      if (r.status === 200 && ct.includes("json")) {
        const t = await r.text();
        console.log(`      Preview: ${t.slice(0, 200)}...`);
      }
    } catch (e: any) {
      console.log(`    ❌ ${c} → ${e?.message ?? e}`);
    }
  }
}

async function probeRunedia() {
  console.log("\n" + "=".repeat(70));
  console.log("Runedia — calendario Mundo Deportivo");
  console.log("=".repeat(70));

  const res = await fetch("https://runedia.mundodeportivo.com/calendario-carreras/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const html = await res.text();
  console.log(`  HTML size: ${html.length}`);

  // Buscar patrones de Carrera individual
  const links = [...new Set(
    (html.match(/<a[^>]+href=["'][^"']*\/carrera[^"']*["']/g) ?? []).map(s => {
      const m = s.match(/href=["']([^"']+)["']/);
      return m?.[1] ?? "";
    })
  )].slice(0, 5);
  console.log(`  Links a carreras: ${links.length}`);
  links.forEach((l) => console.log(`    - ${l}`));

  // Buscar data JSON embebida
  const jsonMatches = html.match(/(?:data|races|events)\s*[:=]\s*(\[[\s\S]{50,500}?\])/g);
  if (jsonMatches) {
    console.log(`  Posibles JSON embebidos: ${jsonMatches.length}`);
    jsonMatches.slice(0, 2).forEach((m) => console.log(`    - ${m.slice(0, 200)}...`));
  }
}

async function main() {
  await probeFedme();
  await probeItra();
  await probeSportmaniacs();
  await probeRunedia();
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
