// =============================================================================
// mi-dorsal — Genera STRAVA_TOKEN_KEY
// =============================================================================
// Genera una clave aleatoria de 32 bytes (256 bits) en base64, apta para
// AES-256-GCM. Usar como env var STRAVA_TOKEN_KEY en Vercel y .env.local.
//
// Uso: npx tsx scripts/generate-strava-key.ts
// =============================================================================

import { randomBytes } from "crypto";

const key = randomBytes(32);
const base64 = key.toString("base64");
const hex = key.toString("hex");

console.log("✅ Clave generada. Copia la que prefieras (recomendado: base64):\n");
console.log(`STRAVA_TOKEN_KEY_BASE64=${base64}`);
console.log(`STRAVA_TOKEN_KEY_HEX=${hex}`);
console.log("\nEn Vercel:");
console.log("  Settings → Environment Variables → Add");
console.log("  Key: STRAVA_TOKEN_KEY");
console.log(`  Value: ${base64}  (o la versión hex, ambas funcionan)`);
console.log("\n⚠️ NO commitees esta clave. NO la compartas. NO la pierdas (si la pierdes,");
console.log("   los tokens de Strava existentes quedan irrecuperables y los usuarios");
console.log("   tendrán que re-conectar con OAuth).");
