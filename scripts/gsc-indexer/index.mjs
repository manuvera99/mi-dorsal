#!/usr/bin/env node
/**
 * gsc-indexer · mi-dorsal
 *
 * Pide indexacion en masa a Google Search Console usando la
 * URL Inspection API. Para usar:
 *
 *  ═══════════════════════════════════════════════════════════════════
 *  MODO 1 — Service account (recomendado para uso recurrente)
 *  ═══════════════════════════════════════════════════════════════════
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
 *  ═══════════════════════════════════════════════════════════════════
 *  MODO 2 — OAuth personal (rapido, sin setup en GCP)
 *  ═══════════════════════════════════════════════════════════════════
 *
 *  Solo 1 comando antes de correr el script:
 *
 *     gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters
 *
 *     (Abre navegador, login con tu Gmail, acepta el scope webmasters)
 *
 *  Luego:
 *
 *     AUTH_MODE=oauth SITE_URL="https://www.mi-dorsal.com" node index.mjs
 *
 *  El token dura ~1h. Si caduca, vuelve a ejecutar gcloud auth.
 *
 *  ═══════════════════════════════════════════════════════════════════
 *  FLUJO COMUN
 *  ═══════════════════════════════════════════════════════════════════
 *
 *  3. Listar URLs a indexar en scripts/gsc-indexer/urls.txt (1 por linea).
 *     O generar con fetch-urls-from-sitemap.mjs
 *
 *  4. Ejecutar:
 *     cd scripts/gsc-indexer
 *     npm install
 *     SITE_URL="https://www.mi-dorsal.com" node index.mjs
 *
 *  Output: scripts/gsc-indexer/results.csv
 *  (timestamp, url, verdict, coverage_state, indexing_result, error)
 *
 *  Coste: gratis. Quota GSC: ~200 indexaciones/dia, ~600 inspections/min.
 */

import { readFile, writeFile } from "node:fs/promises";
import { google } from "googleapis";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { env, exit, stdout } from "node:process";

// ============================================================================
// Config
// ============================================================================
const SITE_URL = env.SITE_URL || "https://www.mi-dorsal.com";
const AUTH_MODE = (env.AUTH_MODE || (existsSync(resolve("./credentials.json")) ? "service-account" : "oauth"))
  .toLowerCase()
  .replace("_", "-");
const URLS_FILE = resolve("./urls.txt");
const CREDENTIALS_FILE = resolve("./credentials.json");
const RESULTS_FILE = resolve("./results.csv");
const RATE_LIMIT_MS = 1200; // ~50 req/min — bajo el limite de 600/min de quota
const BATCH_SIZE = 50; // pausa entre batches para no agotar quota diaria

// ============================================================================
// Helpers
// ============================================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log2(msg, level = "info") {
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
// Auth (soporta service-account y oauth)
// ============================================================================
async function authorize() {
  const SCOPES = ["https://www.googleapis.com/auth/webmasters"];

  if (AUTH_MODE === "service-account") {
    if (!existsSync(CREDENTIALS_FILE)) {
      log2(`No encuentro ${CREDENTIALS_FILE}.`, "err");
      log2(`O crea uno nuevo o usa AUTH_MODE=oauth (mas rapido).`, "err");
      exit(1);
    }
    log2(`Auth: service account (credentials.json)`, "info");
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_FILE,
      scopes: SCOPES,
    });
    return await auth.getClient();
  }

  if (AUTH_MODE === "oauth") {
    // Login OAuth via token.json (generado por login.mjs)
    const TOKEN_FILE = resolve("./token.json");
    if (!existsSync(TOKEN_FILE)) {
      log2(`No encuentro token.json. Ejecuta primero:`, "err");
      log2(`  node login.mjs`, "err");
      log2(`(hace falta oauth-client.json con client_id + client_secret)`, "err");
      exit(1);
    }
    const { client_id, client_secret, refresh_token } = JSON.parse(
      await readFile(TOKEN_FILE, "utf8"),
    );
    log2(`Auth: OAuth (token.json con refresh_token)`, "info");
    const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
    oauth2Client.setCredentials({ refresh_token });
    // Refresca el access token bajo demanda (google-auth-library lo hace solo)
    return oauth2Client;
  }

  log2(`AUTH_MODE desconocido: "${AUTH_MODE}". Usa "service-account" o "oauth".`, "err");
  exit(1);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  if (!existsSync(URLS_FILE)) {
    log2(`No encuentro ${URLS_FILE}. Crea el archivo con 1 URL por linea.`, "err");
    log2(`Tip: corre primero fetch-urls-from-sitemap.mjs para generarlo.`, "err");
    exit(1);
  }

  const urls = await readUrls(URLS_FILE);
  log2(`Encontradas ${urls.length} URLs en urls.txt. Site: ${SITE_URL}. Auth: ${AUTH_MODE}.`);

  const authClient = await authorize();
  const searchconsole = google.searchconsole({ version: "v3", auth: authClient });

  const csvLines = ["timestamp,url,verdict,coverage_state,indexing_result,error"];
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

      // 2) Request indexing solo si NO esta indexada ya
      if (row.indexing_result === "INDEXING_ALLOWED") {
        // Ya esta indexada — saltamos para no quemar quota
        log2(`SKIP (ya indexada): ${url}`, "warn");
      } else {
        await searchconsole.urlInspection.index.requestIndexing({
          requestBody: {
            inspectionUrl: url,
            siteUrl: SITE_URL,
          },
        });
        row.indexing_result = "REQUEST_SUBMITTED";
        log2(`OK  ${i + 1}/${urls.length}  ${url}`, "ok");
      }
    } catch (err) {
      errors++;
      row.error = err.message?.slice(0, 200) || String(err).slice(0, 200);
      log2(`ERR ${i + 1}/${urls.length} ${url} → ${row.error}`, "err");

      if (row.error.includes("quotaExceeded") || row.error.includes("RATE_LIMIT_EXCEEDED")) {
        log2(`Quota excedida — paro despues de ${i + 1} URLs. Reintenta manana.`, "err");
        break;
      }
      if (row.error.includes("invalid_grant") || row.error.includes("401")) {
        log2(`Token OAuth caducado. Ejecuta: gcloud auth application-default login`, "err");
        log2(`Y vuelve a correr.`, "err");
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
      log2(`Pausa de 10s despues de ${processed} URLs (respiro quota)...`);
      await sleep(10_000);
    } else {
      await sleep(RATE_LIMIT_MS);
    }
  }

  await writeFile(RESULTS_FILE, csvLines.join("\n"), "utf8");
  log2(`Listo. ${processed} URLs procesadas, ${errors} errores. Resultados: ${RESULTS_FILE}`);
}

main().catch((err) => {
  log2(`Fatal: ${err.message}`, "err");
  exit(1);
});