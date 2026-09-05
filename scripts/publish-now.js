// Script one-shot: publica el post directamente via Convex
const { ConvexHttpClient } = require("convex/browser");

async function main() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  const { api } = await import("../convex/_generated/api.js");
  const result = await convex.mutation(api.blog.publish, {
    id: "kn74tmsrvx4dzyck1xa8d7ek258dvv0q",
  });
  console.log("✅ Post publicado:", result);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
