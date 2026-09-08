// Ejecuta una action de Convex usando el accessToken del CLI (no Clerk).
// La action se llama con "use node" y sin requireUser, por lo que la policy
// de Convex la acepta si la request lleva un token de admin (deploy key).
//
// Uso: node _admin-call.mjs <functionName> <jsonArgs>

import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://precious-goshawk-41.convex.cloud";

const configPath = join(homedir(), ".convex", "config.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const accessToken = config.accessToken;

const fnName = process.argv[2];
const argsJson = process.argv[3] || "{}";
if (!fnName) {
  console.error("usage: node _admin-call.mjs <functionName> <jsonArgs>");
  process.exit(1);
}

const args = JSON.parse(argsJson);

// ConvexHttpClient no acepta un access token cualquiera — solo JWTs de Clerk
// o de los auth providers configurados. Para invocar una action sin auth
// usamos la API HTTP interna con un wrapper.
const client = new ConvexHttpClient(url);

try {
  // Para actions públicas, .action funciona aunque falle por la policy de
  // auth. Para invocarlas como admin sin JWT de Clerk, necesitamos la
  // "admin key" del deployment (no el access token del CLI).
  //
  // La admin key se guarda en ~/.convex/config.json bajo otro campo
  // (no accessToken). Si no está, no podemos invocar desde Node — hay que
  // hacerlo desde la app (logueado) o replegar con un cron que lo ejecute.
  const out = await client.action(fnName, args);
  console.log("OK:", JSON.stringify(out, null, 2));
} catch (e) {
  console.error("FAIL:", e?.message ?? e);
}
