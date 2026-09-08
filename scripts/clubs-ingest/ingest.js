// scripts/clubs-ingest/ingest.js
// Descarga las 19 páginas de la RFEA (ranking por CCAA) y extrae los clubes
// del <select name="club">. Normaliza, deduplica y genera lib/data/clubs.json
// con el formato que consumirá el componente ClubSelect.
//
// Uso: node scripts/clubs-ingest/ingest.js
// Requiere: Node 18+ (usa fetch global).

const fs = require("fs");
const path = require("path");

const SLUGS = [
  { slug: "and", name: "Andalucía" },
  { slug: "ara", name: "Aragón" },
  { slug: "ast", name: "Asturias" },
  { slug: "bal", name: "Islas Baleares" },
  { slug: "can", name: "Cantabria" },
  { slug: "cat", name: "Cataluña" },
  { slug: "ceu", name: "Ceuta" },
  { slug: "cle", name: "Castilla y León" },
  { slug: "clm", name: "Castilla-La Mancha" },
  { slug: "cnr", name: "Canarias" },
  { slug: "cva", name: "Comunidad Valenciana" },
  { slug: "ext", name: "Extremadura" },
  { slug: "gal", name: "Galicia" },
  { slug: "mad", name: "Madrid" },
  { slug: "mel", name: "Melilla" },
  { slug: "mur", name: "Murcia" },
  { slug: "nav", name: "Navarra" },
  { slug: "pvc", name: "País Vasco" },
  { slug: "rio", name: "La Rioja" },
];

// Normalización de nombre:
// - Trim y colapsa espacios.
// - Pasa a Title Case respetando siglas y nombres propios comunes del running
//   español (C.A., C.D., A.D., A.C., etc.). La RFEA los da en MAYÚSCULAS
//   completas; eso es feo en un <select>.
// - Quita comillas HTML entities (&quot; → ").
function normalizeName(raw) {
  let s = raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Title Case letra por letra, pero respetando siglas y palabras cortas
  // que se quedan en mayúsculas (C.A., DE, LA, etc.).
  const KEEP_UPPER = new Set(["CA", "CD", "AD", "AC", "CP", "SD", "SA", "SL", "SC", "AT", "ATL"]);
  s = s
    .split(" ")
    .map((word) => {
      const clean = word.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9.\-"]/g, "");
      if (!clean) return word;
      const upper = clean.toUpperCase();
      if (KEEP_UPPER.has(upper.replace(/\.$/, ""))) return upper;
      // Title case: primera mayúscula, resto minúscula. Respeta acentos.
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    })
    .join(" ");
  return s;
}

// Extrae los <option> del <select name="club">. Cada option trae el nombre
// del club (texto) y un ID interno de Salesforce (value) que descartamos.
function extractClubsFromHtml(html) {
  // Encuentra el <select name="club"> y captura todos los <option> hasta </select>
  const selectMatch = html.match(/<select[^>]*\sname="club"[^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) return [];
  const inner = selectMatch[1];
  const options = [];
  const optionRe = /<option[^>]*\svalue="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
  let m;
  while ((m = optionRe.exec(inner)) !== null) {
    const value = m[1];
    const label = m[2].replace(/<[^>]+>/g, "").trim();
    if (!value || !label) continue; // opción vacía "Club"
    options.push({ value, label });
  }
  return options;
}

async function fetchOne(item) {
  const url = `https://atletismorfea.es/federaciones/ranking/${item.slug}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "mi-dorsal-clubs-ingest/1.0 (contact: manu@mi-dorsal.es)",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${item.slug}`);
  const html = await res.text();
  const raw = extractClubsFromHtml(html);
  return { ccaa: item.name, slug: item.slug, clubs: raw };
}

async function main() {
  console.log(`Descargando ${SLUGS.length} federaciones de la RFEA…`);
  const results = await Promise.all(SLUGS.map(fetchOne));

  // Normaliza y deduplica por (nombre normalizado lowercase, ccaa).
  const seen = new Set();
  const clubs = [];
  let totalRaw = 0;
  let droppedDuplicate = 0;
  for (const { ccaa, clubs: raw } of results) {
    totalRaw += raw.length;
    for (const r of raw) {
      const name = normalizeName(r.label);
      const key = `${name.toLowerCase()}|${ccaa.toLowerCase()}`;
      if (seen.has(key)) {
        droppedDuplicate += 1;
        continue;
      }
      seen.add(key);
      clubs.push({ name, ccaa });
    }
  }

  // Ordena por nombre para que el <select> sea fácil de escanear.
  clubs.sort((a, b) => a.name.localeCompare(b.name, "es"));

  const out = {
    source: "RFEA — Real Federación Española de Atletismo",
    sourceUrls: SLUGS.map((s) => ({
      ccaa: s.name,
      url: `https://atletismorfea.es/federaciones/ranking/${s.slug}`,
    })),
    fetchedAt: new Date().toISOString(),
    totalRaw,
    droppedDuplicate,
    total: clubs.length,
    clubs,
  };

  const outPath = path.join(__dirname, "..", "..", "lib", "data", "clubs.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`OK — totalRaw=${totalRaw}, droppedDuplicates=${droppedDuplicate}, total=${clubs.length}`);
  console.log(`Escrito: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
