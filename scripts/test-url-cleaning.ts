import { cleanUrl, diagnoseUrl } from "../lib/ai/clean-url";
import { extractRaceFromUrl } from "../lib/ai/extract-race";
import { deepExtractRace } from "../lib/ai/extract-race-deep";
import { analyzeDataSource } from "../lib/ai/analyze-source";

async function main() {
  console.log("Test: caracteres invisibles en URLs\n");

  // Casos extremos de URLs malformadas
  const cases = [
    {
      name: "BOM al inicio",
      url: "\uFEFFhttps://www.15knocturnavalencia.com/",
    },
    {
      name: "BOM + zero-width space",
      url: "\uFEFFhttps://\u200Bwww.15knocturnavalencia.com/",
    },
    {
      name: "Zero-width chars en medio",
      url: "https://www.\u200B\u200C15knocturnavalencia.com/",
    },
    {
      name: "Non-breaking space",
      url: "https://\u00A0www.15knocturnavalencia.com/",
    },
    {
      name: "Multiples BOMs",
      url: "\uFEFF\uFEFFhttps://www.15knocturnavalencia.com/\uFEFF",
    },
    {
      name: "URL con carácter > 255 (BOM en pos 7)",
      url: "https://" + "\uFEFF" + "www.15knocturnavalencia.com/",
    },
  ];

  for (const c of cases) {
    console.log(`\n=== ${c.name} ===`);
    const diag = diagnoseUrl(c.url);
    console.log(`  Original: ${JSON.stringify(c.url)}`);
    console.log(`  Chars raros:`, diag.removed.map((r) => `pos ${r.position}: ${r.char} (code ${r.code})`));
    console.log(`  Limpiada:  ${JSON.stringify(diag.cleaned)}`);

    // Test que extractRaceFromUrl no falla
    try {
      const data = await extractRaceFromUrl(c.url);
      console.log(`  ✅ extractRaceFromUrl OK:`, data?.name ?? "(sin nombre)");
    } catch (e: any) {
      console.log(`  ❌ extractRaceFromUrl error:`, e?.message ?? e);
    }
  }

  console.log("\n=== Test analyzeDataSource (que es el que fallaba al usuario) ===");
  try {
    const data = await analyzeDataSource("\uFEFFhttps://www.fedme.es/");
    console.log("  ✅ OK,", data?.name ?? data?.description?.slice(0, 50));
  } catch (e: any) {
    console.log("  ❌ Error:", e?.message ?? e);
  }
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
