#!/usr/bin/env node
/**
 * list-sites.mjs · mi-dorsal
 *
 * Lista TODAS las propiedades de GSC a las que tiene acceso
 * el usuario OAuth autenticado. Sirve para saber el siteUrl
 * EXACTO que hay que pasar a index.mjs.
 *
 * USO:
 *   cd scripts/gsc-indexer
 *   node list-sites.mjs
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pkg from "google-auth-library";
const { OAuth2Client } = pkg;

const TOKEN_FILE = resolve("./token.json");
const SCOPES = ["https://www.googleapis.com/auth/webmasters"];

async function getAccessToken() {
  if (!existsSync(TOKEN_FILE)) {
    console.error(`No encuentro token.json. Ejecuta primero: node login.mjs`);
    process.exit(1);
  }
  const { client_id, client_secret, refresh_token } = JSON.parse(
    await readFile(TOKEN_FILE, "utf8"),
  );
  const oauth2 = new OAuth2Client(client_id, client_secret);
  oauth2.setCredentials({ refresh_token });
  const { token } = await oauth2.getAccessToken();
  return token;
}

async function main() {
  const accessToken = await getAccessToken();
  const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  const sites = data.siteEntry || [];
  console.log(`\nPropiedades de GSC (${sites.length}):\n`);
  for (const s of sites) {
    console.log(`  ${s.siteUrl}  (${s.permissionLevel})`);
  }
  console.log(`\nPara usar en index.mjs, copia el siteUrl EXACTO y pasalo con:`);
  console.log(`  SITE_URL="<siteUrl>" node index.mjs\n`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});