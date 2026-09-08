// Test rápido: llamar a la mutation submit de Convex desde local
const { ConvexHttpClient } = require("convex/browser");

const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://precious-goshawk-41.convex.cloud";
const client = new ConvexHttpClient(url);

(async () => {
  try {
    const result = await client.mutation("clubSuggestions:submit", {
      clubName: "Test CLI debug",
      ccaa: "Madrid",
      note: "Llamada directa desde Node para diagnosticar el bug del panel admin",
      contactEmail: "manu@mi-dorsal.es",
    });
    console.log("OK mutation result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("ERROR mutation:", e.message);
    console.error("Stack:", e.stack);
  }
})();
