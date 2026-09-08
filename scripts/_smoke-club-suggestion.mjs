// Smoke test: dispara una sugerencia de club contra prod y verifica que
// el scheduler de notifyAdmin ya no rompe con "nonexistent path: emails.js".
import { ConvexHttpClient } from "convex/browser";

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://precious-goshawk-41.convex.cloud";
const client = new ConvexHttpClient(url);

try {
  const out = await client.mutation("clubSuggestions:submit", {
    clubName: "TestFixPath",
    ccaa: "Valencia",
    note: "smoke-test post-fix",
  });
  console.log("OK submit:", out);
} catch (e) {
  console.error("FAIL submit:", e?.message ?? e);
  process.exit(1);
}
