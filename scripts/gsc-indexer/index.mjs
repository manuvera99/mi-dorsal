#!/usr/bin/env node
/**
 * gsc-indexer · mi-dorsal
 *
 * Pide indexacion en masa a Google Search Console usando la
 * URL Inspection API. Para usar:
 *
 *  1. Crear service account en Google Cloud Console:
 *     - IAM & Admin → Service Accounts → Create Service Account
 *     - Rol: NO necesita rol (es OAuth user-scoped)
 *     - Crear key JSON → guardar como scripts/gsc-indexer/credentials.json
 *
 *  2. Añadir el email del service account como OWNER en GSC:
 *     - https://search.google.com/search-console → Settings → Users
 *     - Add user → pegar el email del service account
 *     - Permission: Owner
 *
 *  3. Listar URLs a indexar en scripts/gsc-indexer/urls.txt (1 por linea).
 *     Max recomendado: 200/dia (cuota API).
 *
 *  4. Ejecutar:
 *     cd scripts/gsc-indexer
 *     npm install
 *     SITE_URL="https://www.mi-dorsal.com" node index.mjs
 *
 *  Output: scripts/gsc-indexer/results.csv
 *  (timestamp, url, verdict, coverage_state, indexing_result, error)
 *
 *  Coste: gratis. La URL Inspection API es free tier con quota de
 *  ~600 req/min y ~200 indexaciones/dia (lo que llega primero).
 */

import { readFile, writeFile } from "node:fs/promises";
import { google } from "googleapis";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { argv, env, exit, stdout } from "node:process";

// ============================================================================
// Config
// ============================================================================
const SITE_URL = env.SITE_URL || "https://www.mi-dorsal.com";
const URLS_FILE = resolve("./urls.txt");
const CREDENTIALS_FILE = resolve("./credentials.json");
const RESULTS_FILE = resolve("./results.csv");
const RATE_LIMIT_MS = 1200; // ~50 req/min — bajo el limite de 600/min de quota
const BATCH_SIZE = 50; // pausa entre batches para no agotar quota diaria

// ============================================================================
// Helpers
// ============================================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg, level = "info") {
  const ts = new Date().toISOString();
  const prefix = { info: "ℹ", ok: "✓", warn: "⚠", err: "✗" }[level] || "ℹ";
  stdout.write(`[${ts}] ${prefix} ${msg}\n`);
}

async function readUrls(file) {
  const text = await readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  // Pre-flight
  if (!existsSync(CREDENTIALS_FILE)) {
    log(`No encuentro ${CREDENTIALS_FILE}. Lee el comentario al inicio de este script.`, "err");
    exit(1);
  }
  if (!existsSync(URLS_FILE)) {
    log(`No encuentro ${URLS_FILE}. Crea el archivo con 1 URL por linea.`, "err");
    exit(1);
  }

  const urls = await readUrls(URLS_FILE);
  log(`Encontradas ${urls.length} URLs en urls.txt. Site: ${SITE_URL}`);

  // Auth con service account
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_FILE,
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  });
  const authClient = await auth.getClient();
  // searchconsole v3 client
  const searchconsole = google.searchconsole({ version: "v3", auth: authClient });

  // Cabecera CSV
  const csvLines = [
    "timestamp,url,verdict,coverage_state,indexing_result,error",
  ];

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const row = {
      timestamp: new Date().toISOString(),
      url,
      verdict: "",
      coverage_state: "",
      indexing_result: "",
      error: "",
    };

    try {
      // 1) Inspect: ver estado actual
      const inspectRes = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl: SITE_URL,
        },
      });
      const result = inspectRes.data?.inspectionResult?.indexStatusResult;
      row.verdict = result?.verdict || "";
      row.coverage_state = result?.coverageState || "";
      row.indexing_result = result?.indexingState || "";

      // 2) Request indexing solo si no esta indexada ya
      if (row.indexing_result === "INDEXING_ALLOWED" || row.coverage_state === "Crawled - currently not indexed") {
        // No solicitamos si YA esta indexada o si fue crawleada hace poco
        log(`SKIP (ya indexada o crawleada): ${url}`, "warn");
      } else {
        // Pedir indexacion real
        await searchconsole.urlInspection.index.requestIndexing({
          requestBody: {
            inspectionUrl: url,
            siteUrl: SITE_URL,
          },
        });
        row.indexing_result = "REQUEST_SUBMITTED";
        log(`OK ${i + 1}/${urls.length}  ${url}`, "ok");
      }
    } catch (err) {
      errors++;
      row.error = err.message?.slice(0, 200) || String(err).slice(0, 200);
      log(`ERR ${i + 1}/${urls.length} ${url} → ${row.error}`, "err");

      // Si la quota se acabo, paramos y avisamos
      if (row.error.includes("quotaExceeded") || row.error.includes("RATE_LIMIT_EXCEEDED")) {
        log(`Quota excedida — paro despues de ${i + 1} URLs. Reintenta manana.`, "err");
        break;
      }
    }

    csvLines.push(
      [
        row.timestamp,
        `"${row.url.replace(/"/g, '""')}"`,
        row.verdict,
        row.coverage_state,
        row.indexing_result,
        `"${row.error.replace(/"/g, '""')}"`,
      ].join(","),
    );

    processed++;
    if (processed % BATCH_SIZE === 0) {
      log(`Pausa de 10s despues de ${processed} URLs (respiro quota)...`);
      await sleep(10_000);
    } else {
      await sleep(RATE_LIMIT_MS);
    }
  }

  await writeFile(RESULTS_FILE, csvLines.join("\n"), "utf8");
  log(`Listo. ${processed} URLs procesadas, ${errors} errores. Resultados: ${RESULTS_FILE}`);
}

main().catch((err) => {
  log(`Fatal: ${err.message}`, "err");
  exit(1);
});