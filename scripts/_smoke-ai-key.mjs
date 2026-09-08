// Smoke test: dispara la action de coach analysis para verificar que
// OPENAI_API_KEY + base URL + model están vivos en Convex prod.
// Requiere usuario logueado; en su defecto, la action lanza Unauthorized
// (que es buena señal: la env no se cayó al guard de OPENAI).
import { ConvexHttpClient } from "convex/browser";

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://precious-goshawk-41.convex.cloud";
const client = new ConvexHttpClient(url);

try {
  const out = await client.action("coachAnalysis:generateMyAnalysis", {});
  console.log("OK analysis:", JSON.stringify(out).slice(0, 200));
} catch (e) {
  console.error("FAIL:", e?.message ?? e);
}
