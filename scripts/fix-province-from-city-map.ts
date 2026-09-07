// =============================================================================
// scripts/fix-province-from-city-map.ts
// =============================================================================
// Reasigna la province correcta a carreras con province="valencia" usando
// un mapeo manual de ciudades de España -> province. Complementa al
// fix-province-from-geo.ts (que usa Nominatim) para los casos donde
// Nominatim no devolvio resultado.
//
// El mapeo incluye capitales de provincia, ciudades grandes y pueblos
// que he visto en el audit del catalogo. Si una ciudad no esta, la
// carrera queda como esta.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/fix-province-from-city-map.ts           # dry-run
//   npx tsx --env-file=.env.local scripts/fix-province-from-city-map.ts --apply   # ejecuta
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const APPLY = process.argv.includes("--apply");

// Mapeo locality -> province. Lowercase para comparacion.
// He incluido las ciudades del audit + capitales + ciudades grandes
// + variantes con tildes. Si tu ciudad no esta, ampliable.
const CITY_TO_PROVINCE: Record<string, string> = {
  // Madrid
  "madrid": "madrid",
  "alcobendas": "madrid", "alcalá de henares": "madrid", "alcála de henares": "madrid",
  "alcorcón": "madrid", "alcorcon": "madrid", "aranjuez": "madrid",
  "arganda del rey": "madrid", "boadilla del monte": "madrid", "collado villalba": "madrid",
  "colmenar viejo": "madrid", "coslada": "madrid", "fuenlabrada": "madrid",
  "galapagar": "madrid", "getafe": "madrid", "las rozas": "madrid",
  "las rozas de madrid": "madrid", "leganés": "madrid", "leganes": "madrid",
  "majadahonda": "madrid", "móstoles": "madrid", "mostoles": "madrid",
  "parla": "madrid", "pinto": "madrid", "pozuelo de alarcón": "madrid",
  "rivas-vaciamadrid": "madrid", "san fernando de henares": "madrid",
  "san sebastián de los reyes": "madrid", "torrejón de ardoz": "madrid",
  "torrelodones": "madrid", "tres cantos": "madrid", "valdemoro": "madrid",
  "villanueva de la cañada": "madrid", "aranjuez": "madrid",
  // Barcelona
  "barcelona": "barcelona", "badalona": "barcelona", "castelldefels": "barcelona",
  "cerdanyola del vallès": "barcelona", "cerdanyola del valles": "barcelona",
  "cornellà de llobregat": "barcelona", "cornella de llobregat": "barcelona",
  "esplugues de llobregat": "barcelona", "gavà": "barcelona", "gava": "barcelona",
  "granollers": "barcelona", "l'hospitalet de llobregat": "barcelona",
  "lhospitalet de llobregat": "barcelona", "manresa": "barcelona",
  "mataró": "barcelona", "mataro": "barcelona", "mollet del vallès": "barcelona",
  "mollet del valles": "barcelona", "palamós": "barcelona", "palamos": "barcelona",
  "rubí": "barcelona", "sabadell": "barcelona", "sant adrià de besòs": "barcelona",
  "sant boi de llobregat": "barcelona", "sant cugat del vallès": "barcelona",
  "sant feliu de llobregat": "barcelona", "sant joan despí": "barcelona",
  "sant vicenç dels horts": "barcelona", "santa coloma de gramenet": "barcelona",
  "terrassa": "barcelona", "vic": "barcelona", "viladecans": "barcelona",
  "vilanova i la geltrú": "barcelona", "vilanova i la geltru": "barcelona",
  "calella": "barcelona", "canet de mar": "barcelona", "malgrat de mar": "barcelona",
  "pineda de mar": "barcelona", "premià de mar": "barcelona",
  // Tarragona
  "tarragona": "tarragona", "reus": "tarragona", "tortosa": "tarragona",
  "cambrils": "tarragona", "salou": "tarragona", "el vendrell": "tarragona",
  "amposta": "tarragona", "valls": "tarragona", "calafell": "tarragona",
  "vila-seca": "tarragona", "vilaseca": "tarragona",
  // Girona
  "girona": "girona", "gerona": "girona", "figueres": "girona", "figueres": "girona",
  "blanes": "girona", "lloret de mar": "girona", "olot": "girona",
  "palafrugell": "girona", "sant feliu de guíxols": "girona",
  "roses": "girona", "salt": "girona",
  // Lleida
  "lleida": "lleida", "lérida": "lleida", "lerida": "lleida",
  "balaguer": "lleida", "tàrrega": "lleida", "tarrega": "lleida",
  "mollerussa": "lleida", "la seu d'urgell": "lleida",
  // Sevilla
  "sevilla": "sevilla", "dos hermanas": "sevilla", "alcalá de guadaíra": "sevilla",
  "alcala de guadaira": "sevilla", "utrera": "sevilla", "mairena del aljarafe": "sevilla",
  "écija": "sevilla", "ecija": "sevilla", "los palacios y villafranca": "sevilla",
  "la rinconada": "sevilla", "carmona": "sevilla", "coria del río": "sevilla",
  "lebrija": "sevilla", "tomares": "sevilla", "bormujos": "sevilla",
  // Granada
  "granada": "granada", "motril": "granada", "almuñécar": "granada",
  "almunecar": "granada", "loja": "granada", "baza": "granada",
  "maracena": "granada", "armilla": "granada", "las gabias": "granada",
  // Córdoba
  "córdoba": "cordoba", "cordoba": "cordoba", "lucena": "cordoba",
  "puente genil": "cordoba", "montilla": "cordoba", "priego de córdoba": "cordoba",
  "baena": "cordoba", "cabra": "cordoba",
  // Málaga
  "málaga": "malaga", "malaga": "malaga", "marbella": "malaga",
  "mijas": "malaga", "vélez-málaga": "malaga", "velez-malaga": "malaga",
  "fuengirola": "malaga", "torremolinos": "malaga", "benalmádena": "malaga",
  "estepona": "malaga", "antequera": "malaga", "ronda": "malaga",
  "nerja": "malaga", "alhaurín de la torre": "malaga", "alhaurin de la torre": "malaga",
  // Murcia
  "murcia": "murcia", "cartagena": "murcia", "lorca": "murcia",
  "molina de segura": "murcia", "alcantarilla": "murcia", "mazarrón": "murcia",
  "ágilas": "murcia", "aguias": "murica", "yecla": "murcia",
  "san javier": "murcia", "totana": "murcia", "jumilla": "murcia",
  "caravaca de la cruz": "murcia", "calasparra": "murcia",
  // Almería
  "almería": "almeria", "almeria": "almeria", "almeráa": "almeria",
  "roquetas de mar": "almeria", "el ejido": "almeria", "ejido (el)": "almeria",
  "nijar": "almeria", "adra": "almeria", "huercal-overa": "almeria",
  "vera": "almeria", "cuevas del almanzora": "almeria",
  // Cádiz
  "cádiz": "cadiz", "cadiz": "cadiz", "jerez de la frontera": "cadiz",
  "algeciras": "cadiz", "san fernando": "cadiz", "el puerto de santa maría": "cadiz",
  "puerto de santa maria (el)": "cadiz", "chiclana de la frontera": "cadiz",
  "sanlúcar de barrameda": "cadiz", "la línea de la concepción": "cadiz",
  "el puerto de santa maria": "cadiz", "puerto real": "cadiz",
  "rota": "cadiz", "conil de la frontera": "cadiz", "tarifa": "cadiz",
  // Huelva
  "huelva": "huelva", "lepe": "huelva", "almonte": "huelva",
  "moguer": "huelva", "ayamonte": "huelva", "isla cristina": "huelva",
  "punta umbría": "huelva", "aracena": "huelva",
  // Jaén
  "jaén": "jaen", "jaen": "jaen", "linares": "jaen", "andújar": "jaen",
  "andujar": "jaen", "úbeda": "jaen", "ubeda": "jaen", "martos": "jaen",
  "alcalá la real": "jaen", "alcala la real": "jaen", "baeza": "jaen",
  // Zaragoza
  "zaragoza": "zaragoza", "calatayud": "zaragoza", "teruel": "teruel",
  "huesca": "huesca", "jaca": "huesca", "alcañiz": "teruel",
  "alcaniz": "teruel", "ejea de los caballeros": "zaragoza",
  "utebo": "zaragoza", "monzón": "huesca", "monzon": "huesca",
  // Toledo
  "toledo": "toledo", "talavera de la reina": "toledo",
  "illescas": "toledo", "seseña": "toledo", "sesena": "toledo",
  "mora": "toledo", "consuegra": "toledo", "madrigal de la vera": "toledo",
  "azucaica": "toledo", "los yébenes": "toledo", "los yebenes": "toledo",
  // Ciudad Real
  "ciudad real": "ciudad real", "puertollano": "ciudad real",
  "tomelloso": "ciudad real", "alcázar de san juan": "ciudad real",
  "alcazar de san juan": "ciudad real", "valdepeñas": "ciudad real",
  "valdepenas": "ciudad real", "manzanares": "ciudad real",
  // Guadalajara
  "guadalajara": "guadalajara", "azuqueca de henares": "guadalajara",
  "cabanillas del campo": "guadalajara", "sigüenza": "guadalajara",
  // Cuenca
  "cuenca": "cuenca", "tarancón": "cuenca", "tarancon": "cuenca",
  "san clemente": "cuenca", "motilla del palancar": "cuenca",
  // Albacete
  "albacete": "albacete", "hellín": "albacete", "hellin": "albacete",
  "villarrobledo": "albacete", "almansa": "albacete", "la roda": "albacete",
  "caudete": "albacete", "tobarra": "albacete",
  // Cáceres
  "cáceres": "caceres", "caceres": "caceres", "plasencia": "caceres",
  "navalmoral de la mata": "caceres", "trujillo": "caceres", "coria": "caceres",
  // Badajoz
  "badajoz": "badajoz", "mérida": "badajoz", "merida": "badajoz",
  "don benito": "badajoz", "almendralejo": "badajoz", "villafranca de los barros": "badajoz",
  "olivenza": "badajoz", "zafra": "badajoz", "montijo": "badajoz",
  // Valladolid
  "valladolid": "valladolid", "medina del campo": "valladolid",
  "laguna de duero": "valladolid", "tudela de duero": "valladolid",
  // Burgos
  "burgos": "burgos", "miranda de ebro": "burgos", "aranda de duero": "burgos",
  // León
  "león": "leon", "leon": "leon", "ponferrada": "leon", "san andrés del rabanedo": "leon",
  "la bañeza": "leon", "astorga": "leon",
  // Palencia
  "palencia": "palencia", "guardo": "palencia", "aguilar de campoo": "palencia",
  // Zamora
  "zamora": "zamora", "benavente": "zamora", "toro": "zamora",
  // Salamanca
  "salamanca": "salamanca", "bÉjar": "salamanca", "bejar": "salamanca",
  "ciudad rodrigo": "salamanca", "sta marta de tormes": "salamanca",
  "santa marta de tormes": "salamanca",
  // Ávila
  "ávila": "avila", "avila": "avila", "arenas de san pedro": "avila",
  "arevalo": "avila",
  // Segovia
  "segovia": "segovia", "cuéllar": "segovia", "cuellar": "segovia",
  "el espinar": "segovia",
  // Soria
  "soria": "soria", "almazán": "soria", "almazan": "soria", "el burgo de osma": "soria",
  // Cantabria
  "santander": "cantabria", "torrelavega": "cantabria", "castro-urdiales": "cantabria",
  "camargo": "cantabria", "piélagos": "cantabria", "pielagos": "cantabria",
  // Asturias
  "oviedo": "asturias", "gijón": "asturias", "gijon": "asturias",
  "avilés": "asturias", "aviles": "asturias", "mieres": "asturias",
  "castrillón": "asturias", "castrillon": "asturias", "langreo": "asturias",
  // Navarra
  "pamplona": "navarra", "iruña": "navarra", "tudela": "navarra",
  "burlada": "navarra", "barañáin": "navarra", "baranain": "navarra",
  "egüés": "navarra", "egues": "navarra", "zizur mayor": "navarra",
  // La Rioja
  "logroño": "la rioja", "logrono": "la rioja", "calahorra": "la rioja",
  "arnedo": "la rioja", "haro": "la rioja", "nájera": "la rioja", "najera": "la rioja",
  // Álava
  "vitoria": "alava", "vitoria-gasteiz": "alava", "gasteiz": "alava",
  "llodio": "alava", "amurrio": "alava",
  // Vizcaya
  "bilbao": "vizcaya", "barakaldo": "vizcaya", "getxo": "vizcaya",
  "portugalete": "vizcaya", "santurtzi": "vizcaya", "sestao": "vizcaya",
  "galdakao": "vizcaya", "durango": "vizcaya",
  // Gipuzkoa
  "donostia": "gipuzkoa", "donostia-san sebastián": "gipuzkoa",
  "san sebastián": "gipuzkoa", "irun": "gipuzkoa", "errenteria": "gipuzkoa",
  "renteria": "gipuzkoa", "eibar": "gipuzkoa", "zarauz": "gipuzkoa",
  "zarauz": "gipuzkoa", "mondragón": "gipuzkoa", "mondragon": "gipuzkoa",
  // Illes Balears
  "palma": "mallorca", "palma de mallorca": "mallorca",
  "calvià": "mallorca", "calvia": "mallorca", "manacor": "mallorca",
  "llucmajor": "mallorca", "inca": "mallorca", "felanitx": "mallorca",
  "pollença": "mallorca", "pollenca": "mallorca", "alcúdia": "mallorca",
  "alcudia": "mallorca", "campos": "mallorca", "marratxí": "mallorca",
  "marratxi": "mallorca", "santa ponça": "mallorca", "santa ponca": "mallorca",
  "ciutadella de menorca": "menorca", "mao": "menorca", "mahón": "menorca",
  "mahon": "menorca", "sant antoni de portmany": "ibiza", "santa eulària des riu": "ibiza",
  "santa eularia des riu": "ibiza", "eivissa": "ibiza",
  // Las Palmas
  "las palmas": "las palmas", "las palmas de gran canaria": "las palmas",
  "telde": "las palmas", "arrecife": "las palmas", "san bartolomé": "las palmas",
  "san bartolome": "las palmas", "puerto del rosario": "las palmas",
  "galdar": "las palmas", "arucas": "las palmas",
  // Sta. Cruz de Tenerife
  "santa cruz de tenerife": "santa cruz de tenerife", "san cristóbal de la laguna": "santa cruz de tenerife",
  "la laguna": "santa cruz de tenerife", "santa cruz": "santa cruz de tenerife",
  "la orotava": "santa cruz de tenerife", "puerto de la cruz": "santa cruz de tenerife",
  "adeje": "santa cruz de tenerife", "arona": "santa cruz de tenerife",
  "granadilla de abona": "santa cruz de tenerife", "los realejos": "santa cruz de tenerife",
  // Ceuta y Melilla
  "ceuta": "ceuta", "melilla": "melilla",
  // Valencia (re-confirmo las legitimas por si acaso)
  "valencia": "valencia", "gandía": "valencia", "gandia": "valencia",
  "sagunto": "valencia", "sagunt": "valencia", "sagunto/sagunt": "valencia",
  "alzira": "valencia", "xàtiva": "valencia", "xativa": "valencia",
  "ontinyent": "valencia", "paterna": "valencia", "torrent": "valencia",
  "burjassot": "valencia", "manises": "valencia", "mislata": "valencia",
  "quart de poblet": "valencia", "aldaia": "valencia", "picassent": "valencia",
  "silla": "valencia", "cullera": "valencia", "oliva": "valencia",
  "alcàsser": "valencia", "alcasser": "valencia", "alboraya": "valencia",
  "alboraia": "valencia", "meliana": "valencia", "foios": "valencia",
  "museros": "valencia", "puçol": "valencia", "pucol": "valencia",
  "puig": "valencia", "el puig": "valencia", "rocafort": "valencia",
  "catarroja": "valencia", "alfafar": "valencia", "massanassa": "valencia",
  "cheste": "valencia", "chiva": "valencia", "buñol": "valencia",
  "bunyol": "valencia", "godelleta": "valencia", "quart de les valls": "valencia",
  "faura": "valencia", "l'olleria": "valencia", "olleria (l')": "valencia",
  // Alicante
  "alicante": "alicante", "alacant": "alicante", "alcoy": "alicante", "alcoi": "alicante",
  "elche": "alicante", "elx": "alicante", "torrevieja": "alicante",
  "orihuela": "alicante", "benidorm": "alicante", "alcantarilla": "alicante",
  "petrer": "alicante", "crevillent": "alicante", "elda": "alicante",
  "aspe": "alicante", "novelda": "alicante", "ibi": "alicante",
  "calp": "alicante", "calpe": "alicante", "altea": "alicante",
  "denia": "alicante", "dénia": "alicante", "javea": "alicante", "xàbia": "alicante",
  "xabia": "alicante", "villajoyosa": "alicante", "la vila joiosa": "alicante",
  "santa pola": "alicante", "guardamar del segura": "alicante",
  "callosa de segura": "alicante", "almoradí": "alicante", "almoradi": "alicante",
  "cox": "alicante", "granja de rocamora": "alicante", "banyeres de mariola": "alicante",
  "castalla": "alicante", "ibi": "alicante", "onil": "alicante", "biar": "alicante",
  "villena": "alicante", "elda": "alicante", "sax": "alicante",
  "hondón de las nieves": "alicante", "hondon de las nieves": "alicante",
  "aspe": "alicante", "novelda": "alicante", "monforte del cid": "alicante",
  "monovar": "alicante", "monóvar": "alicante", "pinoso": "alicante",
  // Castellón
  "castellón de la plana": "castellon", "castello de la plana": "castellon",
  "castellón": "castellon", "castellon": "castellon",
  "villarreal": "castellon", "vila-real": "castellon",
  "burriana": "castellon", "borriana": "castellon",
  "vinaròs": "castellon", "vinaros": "castellon",
  "benicarló": "castellon", "benicarlo": "castellon",
  "benicàssim": "castellon", "benicassim": "castellon",
  "oropesa del mar": "castellon", "oropesa": "castellon", "orpesa": "castellon",
  "peñíscola": "castellon", "peniscola": "castellon",
  "alcora": "castellon", "onda": "castellon", "nules": "castellon",
  "moncofa": "castellon", "almenara": "castellon", "xilxes": "castellon",
  "vilafamés": "castellon", "vilafames": "castellon",
  "segorbe": "castellon", "altura": "castellon", "jérica": "castellon", "jerica": "castellon",
};

function lookupCity(loc: string | null | undefined): string | null {
  if (!loc) return null;
  const norm = loc.toLowerCase().trim();
  return CITY_TO_PROVINCE[norm] ?? null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) { console.error("❌ NEXT_PUBLIC_CONVEX_URL no definido"); process.exit(1); }
  const client = new ConvexHttpClient(url);

  console.log("=".repeat(72));
  console.log(`Reasignar province con city-map — modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("=".repeat(72));

  const r = await client.query(api.races.systemListAll, {});
  // Carreras con province=valencia y locality que sí está en nuestro mapa
  const toFix = r.filter((x: any) => {
    if (x.province !== "valencia") return false;
    const newP = lookupCity(x.locality);
    return newP && newP !== "valencia";
  });
  console.log(`\nCarreras a reasignar: ${toFix.length}`);

  if (toFix.length === 0) {
    console.log("✅ Nada que reasignar con city-map (todas las de province=valencia que sí son de Valencia, o no están en el mapa).");
    return;
  }

  console.log("\nMuestra:");
  for (const x of toFix.slice(0, 10)) {
    console.log(`  ${x.startDate}  ${x.name.slice(0, 50)}  →  ${lookupCity(x.locality)}`);
  }
  if (toFix.length > 10) console.log(`  ... y ${toFix.length - 10} más`);

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Se reasignarían ${toFix.length} carreras.`);
    console.log("Añade --apply para ejecutar.");
    return;
  }

  console.log(`\n[APPLY] Reasignando ${toFix.length} carreras...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < toFix.length; i++) {
    const x = toFix[i];
    const newProv = lookupCity(x.locality);
    try {
      await client.mutation(api.races.systemUpdate, {
        id: x._id,
        patch: { province: newProv as any },
      });
      ok++;
    } catch (e: any) {
      fail++;
      console.error(`\n  Error en "${x.name}": ${e?.message ?? e}`);
    }
    if ((i + 1) % 50 === 0 || i === toFix.length - 1) {
      console.error(`[progreso] ${i + 1}/${toFix.length}  ok=${ok}  fail=${fail}`);
    }
  }
  console.log(`\n✅ ${ok} reasignadas, ${fail} fallaron`);
}

main().catch((e) => { console.error(e); process.exit(1); });
