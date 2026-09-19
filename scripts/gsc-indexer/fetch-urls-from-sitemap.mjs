#!/usr/bin/env node
/**
 * fetch-urls-from-sitemap · mi-dorsal
 *
 * Descarga el sitemap.xml de mi-dorsal.com y genera urls.txt con todas
 * las URLs (o solo las N mas prioritarias segun heuristica).
 *
 * Uso:
 *   SITE_URL="https://www.mi-dorsal.com" node fetch-urls-from-sitemap.mjs
 *   SITE_URL="https://www.mi-dorsal.com" MAX=50 node fetch-urls-from-sitemap.mjs
 *
 * Por defecto MAX=200 (cuota diaria recomendada de GSC).
 * Cambia MAX si quieres un subconjunto (p.ej. solo las top 20).
 *
 * Heuristica de prioridad:
 *   - Quita blog y legales (tienen menos valor SEO de carreras)
 *   - Mantiene /, /carreras, /ranking, /blog, /blog/<post>
 *   - Mantiene todas las fichas /carreras/<slug> ordenadas por lastmod DESC
 */

import { writeFile } from "node:fs/promises";
import { env } from "node:process";

const SITE_URL = env.SITE_URL || "https://www.mi-dorsal.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const MAX = parseInt(env.MAX || "200", 10);
const OUTPUT = "./urls.txt";

async function main() {
  console.log(`Descargando ${SITEMAP_URL}...`);
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    console.error(`ERROR: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const xml = await res.text();

  // Extrae pares <loc>...</loc> + <lastmod>...</lastmod> en orden
  const entries = [];
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    entries.push({ loc: m[1], lastmod: m[2] });
  }

  // Ordena por lastmod DESC (mas recientes primero = mas probabilidad de crawling)
  entries.sort((a, b) => (a.lastmod < b.lastmod ? 1 : -1));

  // Heuristica: prioriza fichas de carreras sobre landings/blog
  const ranked = entries
    .map((e) => {
      let score = 0;
      const path = new URL(e.loc).pathname;
      if (path.startsWith("/carreras/") && path !== "/carreras") score = 100; // fichas
      if (path === "/") score = 50;
      if (path === "/carreras") score = 60;
      if (path === "/ranking") score = 40;
      if (path.startsWith("/blog/") && !path.startsWith("/blog/categoria")) score = 20;
      return { ...e, score, path };
    })
    .sort((a, b) => {
      // Score DESC, y dentro de score, lastmod DESC
      if (a.score !== b.score) return b.score - a.score;
      return a.lastmod < b.lastmod ? 1 : -1;
    });

  const top = ranked.slice(0, MAX);
  const urls = top.map((e) => e.loc);

  await writeFile(OUTPUT, urls.join("\n") + "\n", "utf8");
  console.log(`OK ${urls.length} URLs escritas en ${OUTPUT}`);
  console.log(`Primeras 5:`);
  urls.slice(0, 5).forEach((u) => console.log(`  ${u}`));
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});