#!/usr/bin/env node
/**
 * login.mjs · mi-dorsal
 *
 * Login OAuth para gsc-indexer. Abre navegador, login con tu Gmail,
 * acepta el scope, y guarda el refresh token en ./token.json para
 * que index.mjs pueda pedir access tokens en cada ejecucion sin
 * volver a molestar.
 *
 * USO:
 *   1. Crear OAuth Client en GCP:
 *      - APIs & Services → Credentials → Create Credentials → OAuth client ID
 *      - Application type: Desktop app
 *      - Name: gsc-indexer-mi-dorsal
 *      - Download JSON → guardar como oauth-client.json en esta carpeta
 *
 *   2. node login.mjs
 *      (abre navegador, login, acepta, listo)
 *
 *   3. AUTH_MODE=oauth node index.mjs (sin pasar nada mas)
 *
 *  El refresh token NO caduca salvo que lo revoques manualmente.
 *  Solo tienes que hacer login.mjs UNA vez.
 */

import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { URL } from "node:url";
import open from "open";
import { exit } from "node:process";

const CLIENT_FILE = resolve("./oauth-client.json");
const TOKEN_FILE = resolve("./token.json");
const SCOPES = ["https://www.googleapis.com/auth/webmasters"];
const REDIRECT_PORT = 3333;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

async function main() {
  if (!existsSync(CLIENT_FILE)) {
    console.error(`No encuentro ${CLIENT_FILE}.`);
    console.error(`Crea un OAuth Client "Desktop app" en GCP y guarda el JSON aqui.`);
    exit(1);
  }

  const client = JSON.parse(await readFile(CLIENT_FILE, "utf8"));
  const installed = client.installed || client.web;
  const { client_id, client_secret } = installed;

  // Construye URL de autorizacion
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline"); // ← clave: pide refresh token
  authUrl.searchParams.set("prompt", "consent"); // ← clave: fuerza a dar refresh token

  console.log(`Abriendo navegador para login...`);
  console.log(`Si no se abre, copia este URL manualmente:\n${authUrl.toString()}\n`);

  // Servidor local que captura el ?code=...
  const code = await new Promise((resolveCode, rejectCode) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");
          if (error) {
            res.end(`<h1>Error: ${error}</h1><p>Pulsa Ctrl+C en la terminal.</p>`);
            server.close();
            return rejectCode(new Error(error));
          }
          if (code) {
            res.end(`<h1>✓ Login OK</h1><p>Puedes cerrar esta ventana y volver a la terminal.</p>`);
            server.close();
            return resolveCode(code);
          }
        }
        res.end("Esperando callback...");
      } catch (err) {
        server.close();
        rejectCode(err);
      }
    });
    server.listen(REDIRECT_PORT, () => {
      open(authUrl.toString()).catch(() => {
        console.error(`No pude abrir el navegador. Abre manualmente:\n${authUrl.toString()}`);
      });
    });
    setTimeout(() => {
      server.close();
      rejectCode(new Error("Timeout esperando callback (5min). Vuelve a ejecutar login.mjs"));
    }, 5 * 60 * 1000);
  });

  // Intercambia code por tokens
  console.log("Intercambiando code por tokens...");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${err}`);
  }

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    throw new Error(`Google no devolvio refresh_token. Comprueba que el usuario no habia dado antes consentimiento a esta app (revocar en https://myaccount.google.com/permissions y reintentar).`);
  }

  // Guarda con metadata
  const out = {
    client_id,
    client_secret,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    obtained_at: new Date().toISOString(),
  };
  await writeFile(TOKEN_FILE, JSON.stringify(out, null, 2), "utf8");

  console.log(`\n✓ Login completado.`);
  console.log(`  Refresh token guardado en ${TOKEN_FILE}`);
  console.log(`\nSiguiente paso:`);
  console.log(`  AUTH_MODE=oauth SITE_URL="https://www.mi-dorsal.com" node index.mjs`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  exit(1);
});