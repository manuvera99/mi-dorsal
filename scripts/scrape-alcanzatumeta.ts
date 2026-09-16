// =============================================================================
// scripts/scrape-alcanzatumeta.ts
// =============================================================================
// Scrape la agenda de carreras de alcanzatumeta.es (Innovative Sports Research
// S.L.). Plataforma de inscripciones especializada en carreras populares del
// sureste de España (Murcia, Alicante, Almería). El calendario público
// (/calendario.php) viene en HTML estático con un <tr> por evento, parseable
// con regex tolerantes (WordPress 4.8.30 + plugin propio "ATM v1.0", puede
// cambiar formato menor sin avisar).
//
// Cada carrera detectada es un evento "contenedor" de una o varias pruebas
// (5K + 10K, infantil + adulto, etc.). Aquí scrapeamos solo el nivel evento:
// nombre, fecha, localidad, provincia, tipo, link a ficha y link de inscripción.
// Las pruebas internas (distancia/precio/horario por modalidad) requieren
// scrapear la ficha individual (futuro enrichment).
//
// Cobertura geográfica:
//   - Murcia    (principal)
//   - Alicante  (bastante)
//   - Almería   (alguna)
//   - Albacete  (ocasional)
// Complementa a Correbirras — juntos cubren prácticamente todo el sureste.
//
// robots.txt: solo bloquea /wp-admin/. Scraping ético.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/scrape-alcanzatumeta.ts          # muestra
//   npx tsx --env-file=.env.local scripts/scrape-alcanzatumeta.ts --upload # sube a Convex
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const SOURCE_URL = "https://www.alcanzatumeta.es/calendario.php";
const BASE_URL = "https://www.alcanzatumeta.es";
const UPLOAD = process.argv.includes("--upload");

interface AlcanzaTuMetaRace {
  /** ID interno (de la URL ?id=NNNNN). Único dentro de ATM, no en mi-dorsal. */
  atmId: string;
  /** Nombre de la carrera. */
  name: string;
  /** Localidad — tal como aparece en el HTML ("Rafal", "Cieza"). */
  locality: string;
  /** Provincia normalizada (lowercase). */
  province: string;
  /** Código ATM del tipo (RU/SND/CT/OBS/TRS) → mapeado a enum interno. */
  typeCode: string;
  /** "road" | "trail" | "mixed" | "obstacle" tras mapeo. */
  raceType: "road" | "trail" | "mixed" | "obstacle";
  /** Fecha de la carrera en ISO (YYYY-MM-DD). */
  startDate: string;
  /** Timestamp Unix del HTML (lo conservamos por si hay desfase horario). */
  startTimestamp: number;
  /** URL a la ficha de evento en ATM. */
  sourceUrl: string;
  /** URL directa al formulario de inscripción en ATM. */
  registrationUrl: string;
  /** URL al cartel/imagen miniatura (puede ser absoluta o relativa). */
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Mapeos
// ---------------------------------------------------------------------------

/**
 * Tipos internos de ATM según el HTML observado (calendario.php):
 *   - RU  = Running (asfalto, populares, millas, medias, maratones)
 *   - SND = Senderismo
 *   - CT  = Campo a Través (carrera cross en pista/herbal — corta)
 *   - OBS = Obstáculos
 *   - TRS = Trail / Trail running (larga, montaña)
 *
 * Si ATM añade un tipo nuevo, lo dejamos como "road" con un warning para que
 * el admin lo revise. La prioridad aquí es NO perder carreras, no acertar
 * siempre el subtipo (la corrección masiva es barata una vez ingestadas).
 */
const TYPE_MAP: Record<string, "road" | "trail" | "mixed" | "obstacle"> = {
  RU: "road",
  SND: "road", // senderismo: no es "road" ni "trail"; lo marcamos como road para que sea visible. Se puede re-clasificar luego en admin.
  CT: "mixed", // campo a través: asfalto+terreno. Es lo más preciso.
  OBS: "obstacle",
  TRS: "trail",
  MCN: "road", // Marcha Nórdica (Caminata Nórdica) — la marcamos como road. NO es trail, es caminata técnica con bastones.
  MLT: "mixed", // Multideporte / Mountain — mezclado. Aparece raramente.
};

/**
 * Provincias que vemos en MAYÚSCULAS en el HTML de ATM. Coinciden con el
 * enum de Convex (`races.province`). Si ATM añade una provincia nueva,
 * devuelve "" y el admin deberá revisarla (no la ingestamos con province
 * inventada para no violar el schema).
 */
const PROVINCE_MAP: Record<string, string> = {
  MURCIA: "murcia",
  ALICANTE: "alicante",
  ALMERIA: "almeria",
  ALBACETE: "albacete",
  VALENCIA: "valencia",
  CASTELLON: "castellon",
  CUENCA: "cuenca",
  TOLEDO: "toledo",
  CIUDAD_REAL: "ciudad real",
  JAEN: "jaen",
  GRANADA: "granada",
  MALAGA: "malaga",
};

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

async function fetchCalendar(): Promise<string> {
  console.log(`Consultando ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; mi-dorsal-bot/1.0; +https://mi-dorsal.com) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return await res.text();
}

/**
 * Parsea cada <tr> del calendario y devuelve un array de carreras.
 * Regex tolerantes: el HTML viene de WordPress 4.8.30 con espacios/saltos
 * arbitrarios. Cada fila tiene siempre estos 5 anclajes:
 *   1. <span style="display: none">UNIX_TS</span>    → fecha
 *   2. src='uploads/Cartel/HASH.jpg'                  → cartel (puede ser /assets/images/no_image.png)
 *   3. <span class='text-muted'>RU</span>             → tipo
 *   4. <strong>Nombre</strong><br/>Localidad / PROV    → nombre+localidad+provincia
 *   5. href=".../slug-de-la-carrera"                  → URL fuente
 *   6. href=".../inscrip-previa.php?id=NNNNNNN"       → URL inscripción + ID ATM
 */
function parseCalendar(html: string): AlcanzaTuMetaRace[] {
  const out: AlcanzaTuMetaRace[] = [];

  // Dividimos en filas. WordPress mete cada <tr>...</tr> en una línea larga.
  // Usamos una regex que captura TODO el contenido de cada fila (lazy, hasta </tr>).
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const tsRe = /<span\s+style="display:\s*none">(\d{10})<\/span>/i;
  // Cartel: href relativo o absoluto, o placeholder no_image
  const imgRe = /<img\s+[^>]*src=['"]([^'"]+)['"][^>]*id=['"]imgCartel['"]/i;
  // A veces la imagen no tiene id='imgCartel' — fallback genérico
  const imgRe2 = /<img\s+[^>]*src=['"]([^'"]*uploads\/Cartel\/[^'"]+)['"]/i;
  const imgReFallback = /<img\s+[^>]*src=['"](\/assets\/images\/no_image\.png)['"]/i;
  const typeRe = /<span\s+class=['"]text-muted['"]>\s*([A-Z]{2,4})\s*<\/span>/i;
  // Nombre + Localidad + Provincia:
  //   <strong>Nombre</strong><br/>Localidad / PROVINCIA<br/>
  const nameBlockRe =
    /<strong>([\s\S]*?)<\/strong>\s*<br\s*\/?>\s*([^<]+?)\s*\/\s*([A-ZÁÉÍÓÚÑ]+)\s*<br/;
  // URL fuente (slug de la carrera)
  const sourceUrlRe = /href="(https?:\/\/(?:www\.)?alcanzatumeta\.es\/[a-z0-9-]+)"/i;
  // URL inscripción (la que lleva ?id=)
  const regUrlRe = /href="(https?:\/\/(?:www\.)?alcanzatumeta\.es\/inscrip-previa\.php\?id=(\d+))"/i;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    // La primera fila es <thead><tr>...headers</tr></thead> — la saltamos
    if (/<th[\s>]/.test(row) || row.includes("EVENTOS DISPONIBLES")) continue;

    const ts = tsRe.exec(row);
    if (!ts) continue; // fila sin timestamp → no es un evento

    const timestamp = parseInt(ts[1], 10);
    if (!Number.isFinite(timestamp) || timestamp < 946684800) {
      // 2000-01-01 = 946684800. Por debajo → descartamos.
      continue;
    }
    const startDate = new Date(timestamp * 1000).toISOString().slice(0, 10);

    // Filtro: solo carreras FUTURAS (o del día de hoy). Pasadas no nos
    // interesan para el catálogo público de mi-dorsal.
    const today = new Date().toISOString().slice(0, 10);
    if (startDate < today) continue;

    const typeMatch = typeRe.exec(row);
    const typeCode = (typeMatch?.[1] ?? "").toUpperCase();
    const raceType = TYPE_MAP[typeCode] ?? "road";

    const nameMatch = nameBlockRe.exec(row);
    if (!nameMatch) {
      // Fila sin nombre visible: probablemente un separador o una fila rara
      // del DataTables (total_registros, etc.). La saltamos.
      continue;
    }
    const name = decodeEntities(nameMatch[1]).trim();
    const locality = decodeEntities(nameMatch[2]).trim();
    const provinceRaw = nameMatch[3].toUpperCase();
    const province = PROVINCE_MAP[provinceRaw] ?? "";

    const sourceUrlMatch = sourceUrlRe.exec(row);
    if (!sourceUrlMatch) continue; // sin URL de ficha → no la podemos enlazar
    // Forzar https: la web tiene redirect a https en el front, pero algunos
  // links absolutos vienen en http (el plugin ATM mezcla protocolos).
  const sourceUrl = sourceUrlMatch[1].replace(/^http:\/\//i, "https://");

    const regUrlMatch = regUrlRe.exec(row);
    if (!regUrlMatch) {
      // Algunas carreras no tienen link de inscripción en el calendario
      // (p.ej. "Apertura de inscripciones programada para..."). Las saltamos:
      // si no hay link de inscripción, no merece ser ingestada en MVP.
      continue;
    }
    const registrationUrl = regUrlMatch[1].replace(/^http:\/\//i, "https://");
    const atmId = regUrlMatch[2];

    // Imagen (cartel)
    let imageUrl: string | undefined;
    const imgMatch = imgRe.exec(row) ?? imgRe2.exec(row) ?? imgReFallback.exec(row);
    if (imgMatch) {
      imageUrl = imgMatch[1].startsWith("http")
        ? imgMatch[1]
        : `${BASE_URL}/${imgMatch[1].replace(/^\/+/, "")}`;
    }

    out.push({
      atmId,
      name,
      locality,
      province,
      typeCode,
      raceType,
      startDate,
      startTimestamp: timestamp,
      sourceUrl,
      registrationUrl,
      imageUrl,
    });
  }

  return out;
}

/**
 * Decodifica las entidades HTML más comunes sin depender de una librería.
 * El HTML de ATM es UTF-8 pero viene con `&nbsp;`, `&amp;`, etc.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Upload a Convex
// ---------------------------------------------------------------------------

async function uploadToConvex(races: AlcanzaTuMetaRace[]): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado en .env.local");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  // Asegurar fuente "alcanzatumeta"
  const sources = await client.query(api.dataSources.listPublic, {});
  let atmSrc = sources.find((s: any) => s.slug === "alcanzatumeta");
  if (!atmSrc) {
    const id: any = await client.mutation(api.dataSources.systemCreate, {
      name: "Alcanza tu Meta",
      slug: "alcanzatumeta",
      type: "scraper",
      description:
        "Agenda de carreras populares del sureste de España (Murcia, Alicante, Almería, Albacete). Plataforma de inscripciones Innovative Sports Research S.L.",
      baseUrl: BASE_URL,
      config: {
        agendaUrl: SOURCE_URL,
        scrapedAt: new Date().toISOString(),
      },
    });
    atmSrc = { _id: id } as any;
    console.log("\n✅ Fuente 'alcanzatumeta' creada en Convex");
  }

  console.log(`\nSubiendo ${races.length} carreras (idempotente via systemUpsert)...\n`);
  let created = 0,
    updated = 0,
    skippedProvince = 0,
    failed = 0;
  const errors: string[] = [];
  const uploadT0 = Date.now();

  for (const r of races) {
    // Si no pudimos mapear la provincia, NO inventamos — saltamos y avisamos.
    // Esto evita violar el enum de Convex (que es cerrado).
    if (!r.province) {
      skippedProvince++;
      process.stdout.write("p"); // 'p' de province-skip
      if (errors.length < 5)
        errors.push(
          `${r.name}: provincia desconocida "${r.name} (${r.locality})"`,
        );
      continue;
    }

    try {
      const res: any = await client.mutation(api.races.systemUpsert, {
        name: r.name,
        locality: r.locality,
        province: r.province as any,
        // Distance: el calendario no la da en este nivel (la da la ficha por
        // prueba). Usamos 10 como default razonable para no bloquear el
        // ingest; la ficha individual enrichment corregirá el dato.
        distanceKm: 10,
        raceType: r.raceType,
        startDate: r.startDate,
        // Hora: el calendario no la da a nivel evento (la da la ficha por prueba).
        // La dejamos undefined para no inventar.
        officialUrl: r.sourceUrl,
        registrationUrl: r.registrationUrl,
        organizer: "Alcanza tu Meta (Innovative Sports Research S.L.)",
        imageUrl: r.imageUrl,
        isPublished: true,
        isFeatured: false,
        scraperAdapter: "alcanzatumeta",
        dataSourceId: atmSrc!._id,
        sourceUrl: r.sourceUrl,
        // Nota: NO pasamos `ingestedAt` — el validador de `systemUpsert` lo
        // rechaza (la migration de fecha la pone el propio backend al insertar).
      });
      if (res?.action === "created") {
        created++;
        process.stdout.write(".");
      } else {
        updated++;
        process.stdout.write("u");
      }
    } catch (e: any) {
      failed++;
      process.stdout.write("x");
      if (errors.length < 5) errors.push(`${r.name}: ${e?.message ?? e}`);
    }
  }

  console.log(`\n\n✅ ${created} creadas, ${updated} actualizadas`);
  if (skippedProvince > 0)
    console.log(`⚠️  ${skippedProvince} saltadas (provincia no mapeada)`);
  if (failed > 0) console.log(`❌ ${failed} fallaron`);
  if (errors.length) console.log("Errores:", errors);

  // Registrar el sync para el admin dashboard
  try {
    const durationMs = Date.now() - uploadT0;
    const status: "success" | "error" =
      failed > created + updated ? "error" : "success";
    await client.mutation(api.dataSources.recordIngestSync, {
      dataSourceSlug: "alcanzatumeta",
      raceCount: created + updated + skippedProvince,
      createdCount: created,
      updatedCount: updated,
      durationMs,
      status,
      triggeredBy: "script:scrape-alcanzatumeta",
      error:
        failed > 0
          ? `${failed} carreras fallaron`
          : skippedProvince > 0
            ? `${skippedProvince} saltadas por provincia desconocida`
            : undefined,
    });
    console.log("\n📊 Sync registrado en dataSources.recordIngestSync");
  } catch (err) {
    console.error("  ✗ error registrando sync:", err);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(70));
  console.log("Scrape alcanzatumeta.es/calendario.php");
  console.log("=".repeat(70));

  const html = await fetchCalendar();
  console.log(`HTML recibido: ${(html.length / 1024).toFixed(1)} KB`);

  const races = parseCalendar(html);
  console.log(`\nCarreras futuras parseadas: ${races.length}\n`);

  // Resumen por tipo y por provincia
  const byType: Record<string, number> = {};
  const byProv: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let noProvince = 0;
  for (const r of races) {
    byType[r.typeCode] = (byType[r.typeCode] ?? 0) + 1;
    const prov = r.province || "?";
    byProv[prov] = (byProv[prov] ?? 0) + 1;
    if (!r.province) noProvince++;
    const m = r.startDate.substring(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + 1;
  }
  console.log("Por tipo (ATM):");
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log(`  ${t.padEnd(4)} → ${n}`));
  console.log("\nPor provincia:");
  Object.entries(byProv)
    .sort((a, b) => b[1] - a[1])
    .forEach((([p, n]) => console.log(`  ${p.padEnd(15)} → ${n}`)));
  console.log("\nPor mes:");
  Object.entries(byMonth)
    .sort()
    .forEach(([m, n]) => console.log(`  ${m} → ${n}`));
  if (noProvince > 0) {
    console.log(
      `\n⚠️  ${noProvince} carreras con provincia no mapeada (serán saltadas en upload)`,
    );
  }

  console.log("\n" + "─".repeat(70));
  console.log("Listado (primeras 20):\n");
  for (const r of races.slice(0, 20)) {
    console.log(
      `${r.startDate}  ${r.typeCode.padEnd(4)} ${r.raceType.padEnd(8)}  ${r.name.slice(0, 50).padEnd(50)}  ${r.locality} (${r.province || "?"})`,
    );
    console.log(`     🔗 ${r.sourceUrl}`);
    console.log(`     📝 ${r.registrationUrl}`);
  }
  if (races.length > 20) {
    console.log(`\n... y ${races.length - 20} más`);
  }

  if (!UPLOAD) {
    console.log(`\nPara subir a Convex: añade --upload`);
    return;
  }

  await uploadToConvex(races);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
