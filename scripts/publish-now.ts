// Script one-shot: publica el post directamente via Convex
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const result = await convex.mutation(api.blog.publish, {
    id: "kn74tmsrvx4dzyck1xa8d7ek258dvv0q" as any,
  });
  console.log("✅ Post publicado:", JSON.stringify(result));
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
