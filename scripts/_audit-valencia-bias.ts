import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Ciudades y pueblos de la provincia de Valencia que SÍ son válidas.
// Cualquier otra cosa debería marcarse como sospechosa.
const VALENCIA_CITIES = new Set([
  "valencia", "gandía", "gandia", "alzira", "sagunto", "sagunt",
  "xàtiva", "xativa", "ontinyent", "requena", "manises", "paterna",
  "burjassot", "burjassot", "mislata", "quart de poblet", "aldaia",
  "torrent", "picassent", "silla", "cullera", "tavernes de la valldigna",
  "oliva", "denia", "dénia", "benidorm", "calp", "calpe", "altea",
  "villajoyosa", "la vila joiosa", "alcoy", "alcoi", "ibi", "elda",
  "petrer", "novelda", "aspe", "crevillent", "elche", "elx",
  "santa pola", "guardamar del segura", "torrevieja", "orihuela",
  "alcantarilla", "molina de segura", "archena", "cieza", "yecla",
  "jumilla", "calasparra", " Caravaca de la cruz", "caravaca",
  // Pueblos pequeños que sí son de Valencia
  "vilamarxant", "villar del arzobispo", "cheste", "chiva",
  "buñol", "bunyol", "alborache", "macastre", "yátova", "yatova",
  "godelleta", "turís", "torís", "montroy", "montroi", "real de montroi",
  "catarroja", "alfafar", "massanassa", "museros", "foios", "meliana",
  "alboraya", "alboraia", "tavernes blanques", "rocafort",
  "pobla de farnals", "puçol", "pucol", "el puig", "puig",
  "sagunto", "puerto de sagunto", "canet d'en berenguer",
  "viver", "vivero", "segorbe", "altura", "jérica", "jerica",
  "villarreal", "vila-real", "burriana", "borriana",
  "nules", "moncofa", "almenara", "la llosa", "xilxes", "chilches",
  // Alicante (también es provincia de la C. Valenciana, no del scheme actual)
  // OJO: en el schema actual "valencia" cubre C. Valenciana completa según
  // la lógica de Sportmaniacs. Mantengo el check limitado a valencia/castellon.
  // Castellón
  "castellón de la plana", "castello de la plana", "castellon",
  "benicàssim", "benicassim", "oropesa", "orpesa", "benicarló",
  "benicarlo", "peñíscola", "peniscola", "vinaròs", "vinaros",
  "alcora", "l'alcora", "onda", "vilafamés", "vilafames",
  "borriol", "sant joan de moró", "sant joan de moro",
]);

// Topónimos valencianos típicos (palabras que en locality indican provincia de Valencia)
// "vlc", "valència", "valencia", "horta", "ruzafa", "cánovas"...
// (No usado por ahora — usamos lista blanca)

function isProbablyValencia(r: any): boolean {
  const loc = (r.locality ?? "").toLowerCase().trim();
  if (!loc) return true; // sin locality, no podemos saber — confiamos en la heurística previa
  return VALENCIA_CITIES.has(loc);
}

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});

  const valencia = r.filter((x: any) => x.province === "valencia");
  console.log(`Total carreras con province='valencia': ${valencia.length}`);
  console.log(`Publicadas y 'valencia': ${valencia.filter((x: any) => x.isPublished).length}`);

  // Distribución de locality
  const byLoc: Record<string, number> = {};
  for (const x of valencia) {
    const k = x.locality || "(vacío)";
    byLoc[k] = (byLoc[k] ?? 0) + 1;
  }
  const sorted = Object.entries(byLoc).sort((a, b) => b[1] - a[1]);
  console.log(`\nLocalities únicas: ${sorted.length}`);
  console.log("\nTop 30 localities:");
  for (const [k, n] of sorted.slice(0, 30)) {
    const flag = isProbablyValencia({ locality: k }) ? "✅" : "❓";
    console.log(`  ${n.toString().padStart(4)}  ${flag}  ${k}`);
  }

  // Localities que NO son de Valencia
  const suspect = valencia.filter((x: any) => !isProbablyValencia(x));
  console.log(`\n🔴 Carreras 'valencia' con locality que NO es de Valencia: ${suspect.length}`);
  // Agrupar
  const bySuspectLoc: Record<string, any[]> = {};
  for (const x of suspect) {
    const k = x.locality || "(vacío)";
    if (!bySuspectLoc[k]) bySuspectLoc[k] = [];
    bySuspectLoc[k].push(x);
  }
  console.log("\nAgrupadas por locality sospechosa (top 30):");
  for (const [k, list] of Object.entries(bySuspectLoc).sort((a, b) => b[1].length - a[1].length).slice(0, 30)) {
    console.log(`  ${list.length.toString().padStart(4)}  ❌  ${k}`);
    for (const x of list.slice(0, 2)) {
      console.log(`         ${x.startDate}  ${x.name.slice(0, 60)}`);
    }
  }

  // Carreras "valencia" con lat/lng fuera de Valencia
  const valencia_bbox = { minLat: 38.6, maxLat: 40.2, minLng: -1.5, maxLng: 0.5 };
  const outOfBox = valencia.filter((x: any) => {
    if (typeof x.latitude !== "number" || typeof x.longitude !== "number") return false;
    return x.latitude < valencia_bbox.minLat || x.latitude > valencia_bbox.maxLat ||
           x.longitude < valencia_bbox.minLng || x.longitude > valencia_bbox.maxLng;
  });
  console.log(`\n🗺️ 'valencia' con lat/lng fuera del bbox de Valencia: ${outOfBox.length}`);
  for (const x of outOfBox.slice(0, 10)) {
    console.log(`  ${x.name.slice(0, 50)}  (${x.latitude.toFixed(2)}, ${x.longitude.toFixed(2)})`);
  }

  // Distribución por fuente para el caso "valencia"
  const bySource: Record<string, number> = {};
  for (const x of valencia) bySource[x.scraperAdapter ?? "?"] = (bySource[x.scraperAdapter ?? "?"] ?? 0) + 1;
  console.log("\n'valencia' por fuente:");
  for (const [k, n] of Object.entries(bySource)) console.log(`  ${k}: ${n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
