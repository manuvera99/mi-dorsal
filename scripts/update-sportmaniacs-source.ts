// =============================================================================
// scripts/update-sportmaniacs-source.ts
// =============================================================================
// Actualiza la fuente Sportmaniacs en Convex para reflejar que ahora usa la
// API REST pública, no el typeahead limitado.
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL no configurado");
  const client = new ConvexHttpClient(convexUrl);

  const sources = await client.query(api.dataSources.listPublic, {});
  const sm = sources.find((s: any) => s.slug === "sportmaniacs");
  if (!sm) {
    console.log("Fuente sportmaniacs no existe — créala primero con seedDefaults");
    return;
  }
  console.log(`Fuente actual: type=${(sm as any).type}, slug=${sm.slug}`);

  await client.mutation(api.dataSources.systemUpdate, {
    id: sm._id,
    patch: {
      type: "api",
      description: "Plataforma de inscripciones deportivas — API REST pública con 25.000+ carreras (api-aws.sportmaniacs.com)",
      config: {
        apiUrl: "https://api-aws.sportmaniacs.com/api/races",
        discoveredAt: new Date().toISOString(),
      },
    },
  });
  console.log("✅ Fuente sportmaniacs actualizada: type=api");

  // Re-leer
  const after = await client.query(api.dataSources.listPublic, {});
  const sm2 = after.find((s: any) => s.slug === "sportmaniacs");
  console.log(`Después: type=${(sm2 as any).type}, desc=${(sm2 as any).description}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
