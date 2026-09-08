// scripts/clubs-ingest/discover-slugs.js
// Descubre qué slugs de CCAA responden 200 en atletismorfea.es/federaciones/ranking/[slug]
// Uso: node scripts/clubs-ingest/discover-slugs.js

const SLUG_CANDIDATES = [
  { slug: "and", name: "Andalucía" },
  { slug: "ara", name: "Aragón" },
  { slug: "ast", name: "Asturias" },
  { slug: "bal", name: "Baleares" },
  { slug: "can", name: "Cantabria" },
  { slug: "cnr", name: "Canarias" },
  { slug: "cle", name: "Castilla y León" },
  { slug: "clm", name: "Castilla-La Mancha" },
  { slug: "cat", name: "Catalunya" },
  { slug: "cva", name: "Comunidad Valenciana" },
  { slug: "ext", name: "Extremadura" },
  { slug: "gal", name: "Galicia" },
  { slug: "rio", name: "La Rioja" },
  { slug: "mad", name: "Madrid" },
  { slug: "mur", name: "Murcia" },
  { slug: "nav", name: "Navarra" },
  { slug: "pvc", name: "País Vasco" },
  { slug: "ceu", name: "Ceuta" },
  { slug: "mel", name: "Melilla" },
];

async function check(item) {
  const url = `https://atletismorfea.es/federaciones/ranking/${item.slug}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "mi-dorsal-clubs-ingest/1.0" },
      redirect: "follow",
    });
    return { slug: item.slug, name: item.name, status: res.status, ok: res.ok };
  } catch (e) {
    return { slug: item.slug, name: item.name, status: 0, ok: false, error: e.message };
  }
}

(async () => {
  const results = await Promise.all(SLUG_CANDIDATES.map(check));
  results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.slug.localeCompare(b.slug));
  for (const r of results) {
    console.log(`${r.ok ? "OK  " : "FAIL"} ${String(r.status).padEnd(4)} ${r.slug.padEnd(5)} ${r.name}`);
  }
  const working = results.filter((r) => r.ok);
  console.log(`---\nWorking slugs (${working.length}/${SLUG_CANDIDATES.length}): ${working.map((r) => r.slug).join(", ")}`);
})();
