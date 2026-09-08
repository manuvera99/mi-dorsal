// Ejecuta detectIntervalsBackfill:runBackfill contra prod.
// Usa la SDK del deploy de Convex (autenticada por la deploy key del .env).
// Espera que la variable CONVEX_DEPLOY_KEY esté en el entorno
// (la pone 'npx convex login' o se lee del .env.local con convex auth).

import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://precious-goshawk-41.convex.cloud";
const deployKey = process.env.CONVEX_DEPLOY_KEY;
if (!deployKey) {
  console.error("CONVEX_DEPLOY_KEY no está en el entorno");
  process.exit(1);
}

const client = new ConvexClient(url, { deployKey });

const userId = process.argv[2];
if (!userId) {
  console.error("usage: node run-backfill.mjs <userId>");
  process.exit(1);
}

try {
  // Las actions públicas requieren auth; pero las actions registradas en
  // convex/auth.config.js como "use node" y SIN requireUser() también se
  // pueden llamar si la deploy key tiene permisos de admin.
  const out = await client.action(api.actions.detectIntervalsBackfill.runBackfill, {
    userId,
    force: false,
  });
  console.log("OK:", JSON.stringify(out, null, 2));
} catch (e) {
  console.error("FAIL:", e?.message ?? e);
  process.exit(1);
}
