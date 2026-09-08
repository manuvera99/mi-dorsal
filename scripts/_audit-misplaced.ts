import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const r = await c.query(api.races.systemListAll, {});

  console.log("=".repeat(72));
  console.log("Auditoría: carreras con locality incongruente con province");
  console.log("=".repeat(72));
  console.log(`Total carreras: ${r.length}`);

  // Heurística: si el locality NO contiene ningún topónimo reconocible de
  // la province, es sospechosa. Como no podemos hacer eso de forma exacta,
  // usamos otra heurística: locality conocido "raro" para España.
  // Lista negra: topónimos típicos de fuera de España que el scraper ha
  // podido capturar (ciudades grandes conocidas).
  const NON_SPAIN_CITIES = [
    // Uzbekistán
    "tashkent", "samarkand", "bukhara", "andijan",
    // Marruecos (Ceuta/Melilla sí, pero mainland no)
    "fnideq", "fez", "rabat", "casablanca", "marrakech", "tanger", "tangier",
    "tetouan", "tetuán", "oujda", "agadir", "kenitra", "meknès", "essaouira",
    // Otros internacionales típicos
    "lisbon", "lisboa", "porto", "paris", "london", "berlin", "rome",
    "buenos aires", "bogota", "lima", "santiago", "mexico",
  ];

  const sm = r.filter((x: any) => x.scraperAdapter === "sportmaniacs");
  const suspects = sm.filter((x: any) => {
    const loc = (x.locality ?? "").toLowerCase();
    if (!loc) return false;
    return NON_SPAIN_CITIES.some((c) => loc.includes(c));
  });
  console.log(`\n🔴 Carreras de Sportmaniacs con locality de fuera: ${suspects.length}`);

  // Agrupar por locality
  const byCity: Record<string, any[]> = {};
  for (const s of suspects) {
    const k = s.locality;
    if (!byCity[k]) byCity[k] = [];
    byCity[k].push(s);
  }
  Object.entries(byCity)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([city, list]) => {
      console.log(`\n  ${city} (${list.length} carreras):`);
      for (const s of list.slice(0, 5)) {
        console.log(`    ${s.startDate}  ${s.name.slice(0, 60)}`);
        console.log(`      province=${s.province}  officialUrl=${s.officialUrl?.slice(0, 80)}`);
      }
      if (list.length > 5) console.log(`    ... y ${list.length - 5} más`);
    });

  // También buscar carreras de otros scraperAdapters que tengan URLs de Sportmaniacs
  // pero que NO se hayan filtrado por el motivo que sea.
  const allWithSmUrl = r.filter((x: any) => /sportmaniacs\.com/.test(x.officialUrl ?? ""));
  console.log(`\nCarreras con URL de sportmaniacs.com en officialUrl: ${allWithSmUrl.length}`);
  const notSportmaniacsAdapter = allWithSmUrl.filter((x: any) => x.scraperAdapter !== "sportmaniacs");
  console.log(`  de las cuales, con scraperAdapter distinto a 'sportmaniacs': ${notSportmaniacsAdapter.length}`);

  // Locality con caracteres no españoles sospechosos
  const weirdChars = sm.filter((x: any) => {
    const loc = x.locality ?? "";
    return /[āēīōūļķļņšžđčćžǎǐǒǔǚǜ]/.test(loc.toLowerCase()) ||
           /\b(pet[ée]n|krak[oó]w|g[üu]tersloh|n[íi]mes)\b/i.test(loc);
  });
  console.log(`\nCarreras con locality con caracteres no españoles típicos: ${weirdChars.length}`);
  for (const s of weirdChars.slice(0, 5)) {
    console.log(`  ${s.name.slice(0, 60)}  →  locality=${s.locality}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
