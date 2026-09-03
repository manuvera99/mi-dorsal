import { analyzeDataSource } from "../lib/ai/analyze-source";
import { cleanUrl, diagnoseUrl } from "../lib/ai/clean-url";

const url = "https://www.correbirras.com/Carreras_Agenda.html";

console.log("URL original:");
console.log("  bytes:", [...url].map((c) => c.charCodeAt(0)).join(" "));
console.log("  length:", url.length);
const diag = diagnoseUrl(url);
console.log("  Chars raros quitados:", diag.removed);
console.log("  Limpiada:", JSON.stringify(diag.cleaned));
console.log("");
console.log("Llamando a analyzeDataSource...");
analyzeDataSource(url)
  .then((d) => {
    console.log("✅ OK");
    console.log("  name:", d?.name);
    console.log("  description:", d?.description?.slice(0, 100));
    console.log("  confidence:", d?.confidence);
  })
  .catch((e) => {
    console.log("❌ Error:", e?.message ?? e);
    if (e?.stack) console.log(e.stack);
  });
