// =============================================================================
// scripts/check-sources-deep.ts
// =============================================================================
// Investigación profunda de cada fuente.
// =============================================================================

const SOURCES: Record<string, string> = {
  "FEDME calendario": "https://fedme.es/carreras-por-montana/",
  "ITRA eventos": "https://itra.run/Events",
  "Sportmaniacs races": "https://sportmaniacs.com/races",
  "Sportmaniacs root": "https://sportmaniacs.com",
  "Runedia calendario MD": "https://runedia.mundodeportivo.com/calendario-carreras/",
  "Runedia buscador MD": "https://runedia.mundodeportivo.com/buscador-resultados-carreras",
};

async function deepCheck(name: string, url: string) {
  console.log("\n" + "=".repeat(70));
  console.log(`${name}`);
  console.log(`URL: ${url}`);
  console.log("=".repeat(70));

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.log(`  ❌ HTTP ${res.status}`);
      // Si es 403/503, intentar con menos headers "raros"
      return;
    }

    const ct = res.headers.get("content-type") ?? "";
    const size = parseInt(res.headers.get("content-length") ?? "0", 10);
    const text = await res.text();

    console.log(`  ✓ HTTP 200, content-type: ${ct.split(";")[0]}, size: ${text.length}`);

    // Buscar señales
    const signals: string[] = [];
    if (/\.supabase\.co|supabase/i.test(text)) {
      const m = text.match(/[a-z0-9]{20,}\.supabase\.co/);
      signals.push(`🔑 Supabase: ${m?.[0] ?? "sí"}`);
    }
    if (/firebaseio\.com|firebase/i.test(text)) {
      signals.push("🔑 Firebase");
    }
    if (/wp-json\/wp\/v\d+|wp\/api/i.test(text)) {
      signals.push("🔑 WordPress REST API");
    }
    if (/graphql|query\s*[A-Z]\w+\s*\(/i.test(text)) {
      signals.push("🔑 GraphQL");
    }
    if (/\/api\/v\d+\/|\/api\/[a-z\-_]+/i.test(text)) {
      const m = [...new Set(text.match(/['"]\/api\/v?\d*\/[a-z\-_/]+['"]/g) || [])];
      if (m.length) signals.push(`API paths: ${m.slice(0, 3).join(", ")}`);
    }
    if (/__NEXT_DATA__|__NUXT__|window\.__INITIAL_STATE__|window\.__APOLLO/i.test(text)) {
      signals.push("SSR data embed (Next/Nuxt/Apollo)");
    }
    if (/_NEXT_DATA|_INITIAL_STATE/i.test(text)) {
      const m = text.match(/(?:NEXT_DATA|INITIAL_STATE)[^=]*=\s*(\{.+?\});/);
      if (m) signals.push(`SSR JSON: ${m[1].slice(0, 200)}...`);
    }
    if (/["']X-API-Key["']|apiKey['"]?\s*:/i.test(text)) {
      signals.push("🔑 API key visible");
    }

    if (signals.length) {
      console.log("  Señales:");
      signals.forEach((s) => console.log(`    - ${s}`));
    } else {
      console.log("  Sin señales de API/JSON embebido");
    }

    // Buscar patrones específicos
    if (/WordPress/.test(text) || /wp-content/.test(text)) {
      console.log("  📝 Es WordPress (RSS/JSON API disponible en /wp-json/)");
    }
    if (/Drupal/.test(text)) {
      console.log("  📝 Es Drupal (JSON API en /jsonapi/)");
    }
    if (/Next\.js|__NEXT_DATA__/.test(text)) {
      console.log("  📝 Es Next.js (datos en __NEXT_DATA__ JSON embebido)");
    }
    if (/nuxt|NUXT/.test(text)) {
      console.log("  📝 Es Nuxt.js (datos en window.__NUXT__)");
    }
    if (/React/i.test(text) && !/Vue/i.test(text)) {
      console.log("  ⚛️  Es React (probable SPA, datos via API)");
    }
    if (/Vue\.js|vue@/i.test(text)) {
      console.log("  🟢 Es Vue.js (probable SPA, datos via API)");
    }
    if (/Angular|ng-version/i.test(text)) {
      console.log("  🅰️  Es Angular (probable SPA, datos via API)");
    }
  } catch (e: any) {
    console.log(`  ❌ Error: ${e?.message ?? e}`);
  }
}

async function main() {
  for (const [name, url] of Object.entries(SOURCES)) {
    await deepCheck(name, url);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
