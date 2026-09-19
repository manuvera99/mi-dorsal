#!/usr/bin/env node
/**
 * gsc-indexer · mi-dorsal
 *
 * Pide indexacion en masa a Google Search Console usando la
 * URL Inspection API REST directo, SIN google-auth-library
 * (esa dep tiene un polyfill de fetch que rompe URLs con ':').
 *
 * FLUJO:
 *   1. Login una sola vez:  node login.mjs
 *   2. Generar URLs:        node fetch-urls-from-sitemap.mjs
 *   3. Indexar:             node index.mjs
 *
 * AUTH_MODES:
 *   - oauth (default): lee ./token.json (generado por login.mjs)
 *   - service-account: lee ./credentials.json (clave privada GCP)
 *
 * USO:
 *   SITE_URL="https://www.mi-dorsal.com/" node index.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { env, exit, stdout } from "node:process";
import crypto from "node:crypto";

// ============================================================================
// Config
// ============================================================================
const SITE_URL = env.SITE_URL || "https://www.mi-dorsal.com";
const AUTH_MODE = (
  env.AUTH_MODE || (existsSync(resolve("./credentials.json")) ? "service-account" : "oauth")
)
  .toLowerCase()
  .replace("_", "-");
const URLS_FILE = resolve("./urls.txt");
const CREDENTIALS_FILE = resolve("./credentials.json");
const TOKEN_FILE = resolve("./token.json");
const RESULTS_FILE = resolve("./results.csv");
const RATE_LIMIT_MS = 1200;
const BATCH_SIZE = 50;
const SEARCHCONSOLE_API = "https://searchconsole.googleapis.com/v1";

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
// Auth: OAuth2 manual via refresh_token (sin librerias, sin side effects)
// Service account se queda como TODO (no lo necesitas: OAuth es lo mas simple)
// ============================================================================
async function getAccessToken() {
  if (!existsSync(TOKEN_FILE)) {
    log2(`No encuentro token.json. Ejecuta primero: node login.mjs`, "err");
    exit(1);
  }
  const { client_id, client_secret, refresh_token } = JSON.parse(
    await readFile(TOKEN_FILE, "utf8"),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Refresh token failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const { access_token, expires_in } = await res.json();
  log2(`Token OK (valido ${expires_in}s)`, "info");
  return access_token;
}

// Para service account: usamos la libreria SOLO en este path (no afecta fetch)
async function getAccessTokenServiceAccount() {
  const { default: pkg } = await import("google-auth-library");
  const { GoogleAuth } = pkg;
  if (!existsSync(CREDENTIALS_FILE)) {
    log2(`No encuentro ${CREDENTIALS_FILE}.`, "err");
    exit(1);
  }
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_FILE,
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  });
  const c = await auth.getClient();
  const t = await c.getAccessToken();
  return t.token;
}

async function getToken() {
  if (AUTH_MODE === "service-account") {
    log2(`Auth: service account (credentials.json)`, "info");
    return await getAccessTokenServiceAccount();
  }
  log2(`Auth: OAuth (token.json con refresh_token)`, "info");
  return await getAccessToken();
}

// ============================================================================
// API calls
// ============================================================================
async function callGsc(token, endpoint, body) {
  const res = await fetch(`${SEARCHCONSOLE_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function inspectUrl(token, url) {
  const data = await callGsc(token, "/urlInspection/index:inspect", {
    inspectionUrl: url,
    siteUrl: SITE_URL,
  });
  return data.inspectionResult?.indexStatusResult || {};
}

// NOTA: urlInspection.index:requestIndexing fue REMOVIDO por Google como
// endpoint publico en 2024. La doc oficial devuelve 404.
// Por tanto este script SOLO INSPECCIONA URLs; no pide indexado.
// Para pedir el indexado: URL Inspection en search.google.com/search-console
// o dejar que Google recrawlee naturalmente cuando descubra el sitemap.

// ============================================================================
// Main
// ============================================================================
async function main() {
  if (!existsSync(URLS_FILE)) {
    log2(`No encuentro ${URLS_FILE}.`, "err");
    log2(`Tip: corre primero fetch-urls-from-sitemap.mjs para generarlo.`, "err");
    exit(1);
  }

  const urls = await readUrls(URLS_FILE);
  log2(`Encontradas ${urls.length} URLs. Site: ${SITE_URL}. Auth: ${AUTH_MODE}.`);

  const token = await getToken();

  const csvLines = ["timestamp,url,verdict,coverage_state,indexing_result,error"];
  let processed = 0;
  let errors = 0;
  let submitted = 0;
  let currentToken = token;

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
      // 1) Inspect
      const result = await inspectUrl(currentToken, url);
      row.verdict = result.verdict || "";
      row.coverage_state = result.coverageState || "";
      row.indexing_result = result.indexingState || "";

      const status =
        row.indexing_result === "INDEXING_ALLOWED"
          ? "INDEXED"
          : row.coverage_state || "UNKNOWN";
      log2(`OK  ${i + 1}/${urls.length}  ${status.padEnd(40)}  ${url}`, "ok");
      submitted++;
    } catch (err) {
      const msg = err.message || String(err);
      row.error = msg.slice(0, 200);
      errors++;
      log2(`ERR ${i + 1}/${urls.length} ${url} → ${row.error}`, "err");

      // Si es 401, refrescar token y reintentar 1 vez
      if (msg.includes("401") && !row._retried) {
        log2(`Token expirado, refrescando...`, "warn");
        try {
          currentToken = await getToken();
          row._retried = true;
          // Retry silencioso (re-loop)
          i--;
          processed--;
          continue;
        } catch (refreshErr) {
          log2(`Refresh fallo: ${refreshErr.message}`, "err");
          break;
        }
      }

      if (msg.includes("quotaExceeded") || msg.includes("RATE_LIMIT_EXCEEDED")) {
        log2(`Quota excedida — paro despues de ${i + 1} URLs.`, "err");
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
      log2(`Pausa de 10s despues de ${processed} URLs...`);
      await sleep(10_000);
    } else {
      await sleep(RATE_LIMIT_MS);
    }
  }

  await writeFile(RESULTS_FILE, csvLines.join("\n"), "utf8");
  log2(
    `Listo. ${processed} URLs procesadas, ${submitted} peticiones enviadas, ${errors} errores. Resultados: ${RESULTS_FILE}`,
  );
}

main().catch((err) => {
  log2(`Fatal: ${err.message}`, "err");
  exit(1);
});