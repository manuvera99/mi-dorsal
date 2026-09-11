// =============================================================================
// scripts/deep-extract-all.ts
// =============================================================================
// Re-procesa TODAS las carreras con officialUrl con la extracción profunda IA.
// Por cada carrera: HEAD probe → (si OK) IA → actualizar via systemUpdate.
//
// HEAD probe: para detectar URLs rotas (404) y marcarlas como "tried, broken"
// sin gastar la llamada a la IA. Esto evita el 50% de calls que fallan con 404
// (típico en sportmaniacs con URLs tipo /races/{slug}/{uuid}/results que la
// plataforma ha dejado de servir).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --limit=5
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --only-missing
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --priority
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --delay=3000
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --skip-probe
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --no-resolve-broken
//
// Flags:
//   --limit=N            Procesa solo las primeras N carreras
//   --only-missing       Solo procesa carreras sin extractedAt
//   --priority           Prioriza no-extraídas + baja-confianza
//   --delay=MS           Pausa entre extracciones (default 2000ms)
//   --skip-probe         Desactiva el HEAD pre-check
//   --rebroken           Reintentar carreras ya marcadas como url_broken
//   --no-resolve-broken  Desactiva la resolución de URL vía búsqueda web
//                        cuando el HEAD probe detecta la URL muerta (por
//                        defecto SÍ se intenta si BRAVE_SEARCH_API_KEY está
//                        configurado — ver lib/ai/resolve-race-url.ts)
//   --include-past       Incluye también carreras con startDate anterior a
//                        hoy (por defecto SOLO se procesan carreras de hoy
//                        en adelante — a un corredor no le importa el dato
//                        de una carrera que ya pasó, y procesarlas gasta
//                        tiempo/cuota de IA y búsqueda sin ningún beneficio)
//
// BACKFILL de las ~2200 carreras con officialUrl muerta (mayormente
// Sportmaniacs, ver auditoría 2026-09-11): usar --rebroken (para reprocesar
// las ya marcadas url_broken) + --priority, en tandas con --limit para
// poder observar la tasa de aciertos de la resolución de URL antes de
// seguir, en vez de un único proceso ciego de horas. Ej:
//   npx tsx --env-file=.env.local scripts/deep-extract-all.ts --rebroken --priority --limit=100 --delay=3000
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  deepExtractRace,
  buildExtractionPatch,
  countAppliedFields,
  type ExtractedRaceDeep,
} from "../lib/ai/extract-race-deep";
import { resolveRaceUrl } from "../lib/ai/resolve-race-url";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
const onlyMissing = args.includes("--only-missing");
const priority = args.includes("--priority");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1]) || 2000;
const skipProbe = args.includes("--skip-probe");
const reBroken = args.includes("--rebroken");
const resolveBroken = !args.includes("--no-resolve-broken");
const includePast = args.includes("--include-past");

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL no configurado en .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

// Bug encontrado en auditoría 2026-09-11: el User-Agent de Chrome falso
// (comentado abajo, ya no se usa) hace que Facebook devuelva 400 a un
// HEAD, marcando como "rota" una URL que en realidad está viva — confirmado
// con curl real contra varias fichas de Facebook usadas como officialUrl.
// El fetch real de extracción (lib/ai/extract-race-deep.ts) usa este mismo
// User-Agent "mi-dorsal/1.0" y SÍ funciona contra esas mismas URLs. Usamos
// el mismo aquí para que el probe y la extracción vean lo mismo.
//   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const UA = "Mozilla/5.0 (compatible; mi-dorsal/1.0; +https://mi-dorsal.es)";

/**
 * HEAD pre-check: si la URL devuelve 404/410/5xx, devolvemos 'broken'.
 * Devuelve 'ok' si 2xx, 'broken' si 4xx/5xx, 'unknown' si hay error de red.
 */
async function probeUrl(url: string): Promise<"ok" | "broken" | "unknown"> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: c.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    clearTimeout(t);
    if (res.status >= 200 && res.status < 400) return "ok";
    if (res.status === 404 || res.status === 410 || res.status >= 500) return "broken";
    return "broken";
  } catch {
    return "unknown";
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("Deep extract all races (MiniMax M3)");
  console.log("=".repeat(70));
  console.log("Flags:", { limit, onlyMissing, priority, delayMs, skipProbe, reBroken, resolveBroken, includePast });

  const all = await client.query(api.races.systemListAll, { onlyWithOfficialUrl: true });
  console.log(`Encontradas ${all.length} carreras con officialUrl`);

  let toProcess = all;

  // Por defecto, solo futuras (startDate >= hoy). Las carreras sin
  // startDate se mantienen (no podemos saber si son futuras o pasadas,
  // mejor procesarlas que descartarlas silenciosamente).
  if (!includePast) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const before = toProcess.length;
    toProcess = toProcess.filter((r: any) => !r.startDate || r.startDate >= todayIso);
    console.log(`Solo futuras (>= ${todayIso}): ${toProcess.length} (descartadas ${before - toProcess.length} pasadas)`);
  }

  if (onlyMissing) {
    toProcess = all.filter((r: any) => !r.extractedAt);
    console.log(`Solo sin extraer: ${toProcess.length}`);
  }
  // Filtrar las marcadas como url_broken salvo que se pase --rebroken
  if (!reBroken) {
    const before = toProcess.length;
    toProcess = toProcess.filter((r: any) => {
      // Heurística: si tiene extractedAt pero solo 1 campo aplicado, es probablemente un skip
      if (r.extractedAt && r.extractionConfidence === "low" && (r as any).longDescription == null && (r as any).organizer == null) {
        return false;
      }
      return true;
    });
    const skipped = before - toProcess.length;
    if (skipped > 0) console.log(`Saltadas ${skipped} marcadas como url_broken (usar --rebroken para forzar)`);
  }

  if (priority) {
    const scoreOf = (r: any): number => {
      if (!r.extractedAt) return 0;
      if (!r.longDescription) return 1;
      if (!r.altimetryData || r.altimetryData.length === 0) return 2;
      if (!r.raceFormats || r.raceFormats.length === 0) return 3;
      return 4;
    };
    toProcess = [...toProcess].sort((a: any, b: any) => {
      const sa = scoreOf(a);
      const sb = scoreOf(b);
      if (sa !== sb) return sa - sb;
      return (a.startDate ?? "").localeCompare(b.startDate ?? "");
    });
    console.log(`Modo priority activado — top 5 más prioritarias:`);
    toProcess.slice(0, 5).forEach((r: any) => {
      const s = scoreOf(r);
      const reason = ["nunca extraída", "sin longDescription", "sin altimetryData", "sin raceFormats", "completa"][s];
      console.log(`  [${s}] ${r.startDate} ${r.name} (${reason})`);
    });
  }
  if (limit > 0) {
    toProcess = toProcess.slice(0, limit);
    console.log(`Limitado a: ${toProcess.length}`);
  }

  if (toProcess.length === 0) {
    console.log("Nada que procesar.");
    return;
  }

  let success = 0;
  let failed = 0;
  let broken = 0;
  let resolvedCount = 0;
  let totalFieldsApplied = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const r: any = toProcess[i];
    const pct = ((i + 1) / toProcess.length * 100).toFixed(0);
    process.stdout.write(`\n[${i + 1}/${toProcess.length} ${pct}%] ${r.name} (${r.slug})\n  ↳ ${r.officialUrl}\n`);

    try {
      const t0 = Date.now();
      let cleanUrl = (r.officialUrl ?? "").replace(/[\uFEFF\u200B-\u200D\u2060]/g, "").trim();
      if (!/^https?:\/\//.test(cleanUrl)) {
        throw new Error(`URL inválida: ${r.officialUrl}`);
      }

      // HEAD probe: skip URLs claramente rotas
      if (!skipProbe) {
        const probe = await probeUrl(cleanUrl);
        if (probe === "broken") {
          // Antes de rendirse: intentar resolver la URL real vía búsqueda
          // web (confirmado con datos reales que esto NO es un problema de
          // formato — las páginas fueron borradas o nunca existieron, así
          // que reconstruir por patrón no funciona; ver
          // lib/ai/resolve-race-url.ts).
          let resolved: Awaited<ReturnType<typeof resolveRaceUrl>> = null;
          if (resolveBroken) {
            resolved = await resolveRaceUrl({
              name: r.name,
              locality: r.locality,
              province: r.province,
              startDate: r.startDate,
            });
          }

          if (resolved && resolved.confidence !== "low") {
            console.log(`  🔎 URL resuelta vía búsqueda (${resolved.confidence}): ${resolved.url}`);
            await client.mutation(api.races.systemUpdate, {
              id: r._id,
              patch: {
                officialUrl: resolved.url,
                officialUrlResolvedAt: Date.now(),
                officialUrlResolvedFrom: resolved.searchQuery,
              },
            });
            cleanUrl = resolved.url;
            resolvedCount++;
            // Cae al flujo normal de extracción IA más abajo, con la URL nueva.
          } else {
            await client.mutation(api.races.systemUpdate, {
              id: r._id,
              patch: {
                extractedFromUrl: cleanUrl,
                extractedAt: Date.now(),
                extractionConfidence: "low",
              },
            });
            console.log(`  ⚠️  HEAD 404/5xx — ${resolveBroken ? "búsqueda no encontró nada fiable" : "resolución desactivada"} — marcado como probado (sin enriquecer)`);
            broken++;
            continue;
          }
        }
      }

      const data: ExtractedRaceDeep | null = await deepExtractRace(cleanUrl);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (!data) {
        console.log(`  ⚠️  IA devolvió null (${dt}s)`);
        await client.mutation(api.races.systemUpdate, {
          id: r._id,
          patch: { extractedFromUrl: cleanUrl, extractedAt: Date.now(), extractionConfidence: "low" },
        });
        failed++;
        continue;
      }
      console.log(`  ✓ IA (${dt}s) confidence=${data.confidence} — ${data.notes ? `"${data.notes.slice(0, 60)}"` : "ok"}`);

      const patch = buildExtractionPatch(data, cleanUrl);
      const fieldsCount = countAppliedFields(patch);
      await client.mutation(api.races.systemUpdate, { id: r._id, patch });
      console.log(`  ✅ ${fieldsCount} campos aplicados`);
      success++;
      totalFieldsApplied += fieldsCount;
    } catch (e: any) {
      console.error(`  ❌ Error: ${e?.message ?? e}`);
      failed++;
    }

    if (i < toProcess.length - 1) {
      process.stdout.write(`  ⏳ Esperando ${delayMs}ms…\n`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  console.log(`✅ ${success} carreras actualizadas con datos IA`);
  console.log(`🔎 ${resolvedCount} URLs resueltas vía búsqueda web (antes muertas)`);
  console.log(`⚠️  ${broken} URLs rotas (HEAD falló, marcadas para no reintentar)`);
  console.log(`❌ ${failed} fallaron por otros motivos`);
  console.log(`📊 ${totalFieldsApplied} campos aplicados en total`);
  if (success > 0) {
    console.log(`⏱  ${(totalFieldsApplied / success).toFixed(1)} campos/carrera (media)`);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("⚠️  Unhandled rejection (continúa):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️  Uncaught exception (continúa):", err);
});

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
