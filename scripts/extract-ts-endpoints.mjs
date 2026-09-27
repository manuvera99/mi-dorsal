// Extrae las URLs de la API del bundle del widget de timingsense.
import fs from "node:fs";
const js = fs.readFileSync(process.argv[2], "utf8");
// Captura cadenas tipo "https://api.../foo" o "/api/v1/foo" (rutas relativas).
const re = /["'`](https?:\/\/[^"'`\s]+|\/api\/[^"'`\s]+|\/v1\/[^"'`\s]+|\/v2\/[^"'`\s]+)["'`]/g;
const urls = new Set();
let m;
while ((m = re.exec(js)) !== null) {
  urls.add(m[1]);
}
const sorted = [...urls].sort();
for (const u of sorted) console.log(u);
