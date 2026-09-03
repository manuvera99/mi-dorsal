// =============================================================================
// scripts/check-sources-tech.ts
// =============================================================================
// Investiga la tecnología de cada fuente de carreras:
//   - ¿Tienen API REST pública?
//   - ¿Cargan datos de Supabase/Firebase?
//   - ¿Tienen endpoints JSON?
//   - ¿Generan HTML server-side o client-side (JS)?
// =============================================================================

import * as fs from "fs";
import * as cheerio from "cheerio";

const SOURCES: Record<string, string[]> = {
  "FEDME (calendario)": [
    "https://www.fedme.es/calendario",
    "https://www.fedme.es/escalada/calendario",
    "https://www.fedme.es/carreras/calendario",
    "https://www.fedme.es",
  ],
  "ITRA (eventos)": [
    "https://itra.run/Events",
    "https://itra.run/Races/FindARace",
    "https://itra.run",
  ],
  "Sportmaniacs (calendario)": [
    "https://sportmaniacs.com/es-es/calendario",
    "https://sportmaniacs.com/es-es",
    "https://sportmaniacs.com",
  ],
  "Runedia (calendario)": [
    "https://runedia.es/eventos",
    "https://runedia.es/calendario",
    "https://runedia.es",
  ],
};

async function checkSource(name: string, urls: string[]) {
  console.log("\n" + "=".repeat(70));
  console.log(`FUENTE: ${name}`);
  console.log("=".repeat(70));

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; mi-dorsal/1.0; +https://mi-dorsal.es)",
          "Accept": "text/html,application/json,application/xhtml+xml",
          "Accept-Language": "es-ES,es;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        console.log(`  ❌ ${url} → HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get("content-type") ?? "";
      const url_text = await res.text();
      const size = url_text.length;

      // Buscar señales de API/JS data sources
      const signals: string[] = [];
      if (ct.includes("json")) signals.push("JSON response");
      if (/supabase/i.test(url_text)) signals.push("🔑 Supabase");
      if (/firebase/i.test(url_text)) signals.push("🔑 Firebase");
      if (/graphql/i.test(url_text)) signals.push("🔑 GraphQL");
      if (/api\/v\d+|\/api\//.test(url_text)) {
        const m = url_text.match(/['"](\/api\/v?\d*\/[a-z\-_/]+)['"]/g);
        if (m) signals.push(`API paths: ${m.slice(0, 3).join(", ")}`);
      }
      if (/NEXT_DATA|__NEXT_DATA__|window\.__/.test(url_text)) {
        signals.push("Next.js SSR data");
      }
      if (/api_key|apikey|X-API-Key/i.test(url_text)) {
        signals.push("API key visible");
      }
      if (/csrf|authenticity_token/i.test(url_text)) {
        signals.push("Tiene CSRF/Auth tokens (webapp)");
      }
      // Buscar scripts que cargan
      const scriptSrcs: string[] = [];
      const $ = cheerio.load(url_text);
      $("script[src]").each((_, el) => {
        const s = $(el).attr("src");
        if (s && !s.startsWith("http") && !s.startsWith("//")) {
          scriptSrcs.push(s);
        }
      });
      // Ver si los links a carreras son rutas claras
      const carreraLinks: string[] = [];
      $("a[href*='carrer'], a[href*='race'], a[href*='event']").each((_, el) => {
        const h = $(el).attr("href");
        if (h && !carreraLinks.includes(h)) carreraLinks.push(h);
      });

      const finalUrl = res.url;
      console.log(`  ✓ ${finalUrl}`);
      console.log(`    Content-Type: ${ct.split(";")[0]}, size: ${size} bytes`);
      if (signals.length) {
        console.log(`    Señales:`);
        signals.forEach((s) => console.log(`      - ${s}`));
      }
      if (carreraLinks.length > 0) {
        console.log(`    Links a carreras: ${carreraLinks.length} (muestra: ${carreraLinks.slice(0, 3).join(", ")})`);
      }
    } catch (e: any) {
      console.log(`  ❌ ${url} → ${e?.message ?? e}`);
    }
  }
}

async function main() {
  console.log("=" .repeat(70));
  console.log("Investigación de fuentes: ¿tienen API pública?");
  console.log("=" .repeat(70));

  for (const [name, urls] of Object.entries(SOURCES)) {
    await checkSource(name, urls);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
