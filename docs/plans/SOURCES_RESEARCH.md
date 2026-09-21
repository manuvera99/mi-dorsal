# SOURCES_RESEARCH — Empresas de cronometraje y plataformas de carreras

> Investigación de las 4 empresas de cronometraje principales del running
> popular español. Cada una se evalúa para ver si es viable como fuente
> automática de resultados en mi-dorsal (catálogo + resultados por dorsal).

---

## Resumen ejecutivo (2026-09-06)

| Empresa | Catálogo | Resultados por dorsal | Estado en mi-dorsal |
|---|---|---|---|
| **Sportmaniacs** (Localbi/Evide) | ✅ API pública `/api/races` | ✅ API `/api/events/{uuid}/race-rankings` (durante live + ~pocas horas post) | ✅ Adapter completo, **2208+ carreras ingestadas** (sep 2026) |
| **ChipLevante** | ✅ AJAX `/modulos/list_pruebas.php` | ✅ AJAX `/secciones/clasificaciones/dame_id_corredor.php` | ✅ Adapter completo, **114 carreras en prod** (sep 2026) |
| **RPM Sports** (Barcelona) | — | — | ❌ **Es Sportmaniacs** — el Maratón Barcelona y Mitja usan su plataforma |
| **Time Runners** (Madrid) | — (manual) | ✅ PDF estático con MYLAPS BibTag | ✅ **Adapter PDF genérico** (sep 2026). Admin añade las carreras a mano. |
| **CronoChip** (Valencia) | — (manual) | ✅ PDF estático | ✅ **Adapter PDF genérico**. Mismo adapter que Time Runners. |
| **Gesconchip** (Cataluña) | — (manual) | ✅ PDF estático | ✅ **Adapter PDF genérico**. Mismo adapter que Time Runners. |
| **MYLAPS Speedhive** (general) | — | — | ❌ **No viable** — requiere API key + onboarding + NDA |

---

## 1. Sportmaniacs (Localbi/Evide) — ✅ IMPLEMENTADO

**Cobertura**: la mayor plataforma del running popular español. Cubre desde
grandes maratones (Zurich Marató Barcelona, Maratón Sevilla, eBay Maratón
Zaragoza, Mitja Marató Barcelona) hasta carreras locales. **Cientos de
carreras en toda España** (norte, levante, sur, centro, islas).

### API pública
- **Catálogo**: `GET https://api-aws.sportmaniacs.com/api/races?page=N&pageSize=25`
  - Devuelve `{data: [{id (UUID), name, slug, date, idRace, province, country, city, ...}], status: "ok"}`
  - El parámetro `search` se IGNORA — devuelve las primeras 25 carreras del paginado.
  - Orden: por defecto, las más recientes primero. Páginas: ~30-80 en total.
- **Resultados por dorsal**: `GET https://api-aws.sportmaniacs.com/api/events/{event-uuid}/race-rankings`
  - Headers necesarios: `X-Requested-With: XMLHttpRequest`, `Origin: https://sportmaniacs.com`, `Referer: https://sportmaniacs.com/...`
  - Devuelve:
    ```json
    {
      "data": {
        "Event": {id, idEvent, name, distance, ranking, has_diploma, ...},
        "Race": {idRace, name, slug, ...},
        "Splits": [...],
        "Categories": [...],
        "Rankings": [
          {dorsal, name, club, category, pos, posCategory, posGender, officialTime, realTime, ...},
          ...
        ],
        "Averages": {...},
        "Summary": [...]
      },
      "status": "ok"
    }
    ```
  - **Limitación importante**: solo devuelve `data.Rankings[]` cuando la
    carrera está en vivo o recién pasada. Una vez archivada, devuelve
    `ranking: false` y `Rankings: []`. El adapter trata esto como "no
    encontrado" y el cron `checkResults` reintentará periódicamente.

### Implementación
- `convex/scraper.ts`:
  - `parseSportmaniacsUrl(url)` — extrae el event UUID de URLs `sportmaniacs.com` o `api-aws.sportmaniacs.com` (cualquier path con un UUID).
  - `scrapeSportmaniacs(url, dorsal)` — llama al endpoint, busca el dorsal en `data.Rankings[]`, devuelve `{runnerName, positionOverall, positionCategory, timeSeconds}` o null.
  - Despachado en `scrapeResults()` ANTES del fetch HTML.
- `convex/races.ts`: `systemUpsert` auto-asigna `scraperAdapter: "sportmaniacs"` cuando el `officialUrl` contiene `sportmaniacs.com`.
- `scripts/migrate-sportmaniacs-attrs.ts` — re-atribuye las 157 carreras
  existentes en prod que estaban mal etiquetadas como "correbirras"
  (mismo bug que chiplevante). Idempotente, multi-source.
- `scripts/ingest-sportmaniacs-2026.ts` — ingesta el catálogo público,
  filtra por año en curso en adelante. `--upload` para subir a Convex.
- `package.json`: scripts `ingest:sportmaniacs:2026` y `migrate:sportmaniacs`.

### Resultados de la ingesta 2026+ (6 sept 2026)
- **Total descargadas**: 2380 carreras (95 páginas)
- **Futuras**: 2379
- **Creadas en Convex**: 2208
- **Actualizadas (ya existían)**: 172
- **Fallaron**: 0
- **Top provincias**: Valencia 127, Madrid 118, Barcelona 117, Toledo 97, Castellón 63, Tarragona 61, Granada 63, Las Palmas 57, Almería 51.

### Cómo se descubrió el endpoint
1. Bundle JS de la webapp (`main.bundle.min.js`) — contiene `app.path()`
   que monta URLs a partir de la config inyectada.
2. Decodificación del `window.config_data` con **zlib inflate** (no LZ-string
   como se intentó inicialmente) — cabecera `eJzN` = `0x78 0x9C` (zlib magic).
3. Lectura del objeto `routes` con todas las URLs del sistema:
   `RaceResultsOfficial`, `FullRankings`, `Athlete`, `RaceSearchAthlete`, etc.
4. Pruebas contra `api-aws.sportmaniacs.com/api/events/{uuid}/race-rankings`
   con UUIDs reales sacados de las páginas de carrera (que exponen
   `window.SMRequest = {event: uuid}`).

---

## 2. ChipLevante — ✅ IMPLEMENTADO (sesión previa)

**Cobertura**: carreras populares de Alicante, Murcia, Albacete y Valencia
(la zona de origen de la empresa).

### Implementación
- Endpoint AJAX público con datos por dorsal (no HTML). Adapter sigue el
  mismo patrón JSON que sportmaniacs.
- Brute-force `(empresa="1"|"") × (carrera=1..5)` para encontrar la
  combinación correcta (10 requests worst case).
- 114 carreras en prod (todas 2026+), 6 futuras + 108 pasadas.
- **Commit**: `0b823c4 feat(chiplevante): adapter de resultados + ingesta del catálogo 2026+`

---

## 3. RPM Sports (Barcelona) — ❌ = SPORTMANIACS

**Conclusión**: NO es una plataforma propia — RPM Sports usa **Sportmaniacs**
para inscripciones y cronometraje de:
- Zurich Marató Barcelona
- Mitja Marató Barcelona (Hyundai)
- eBay Maratón Zaragoza
- Y otras grandes

Ya cubierto por el adapter de Sportmaniacs. Nada que hacer.

---

## 4. Time Runners (Madrid) — ✅ ADAPTER PDF GENÉRICO (sep 2026)

**Cobertura**: Rock 'n' Roll Madrid Marathon y otros eventos de la zona centro.

### Estado actual
- Web WordPress antigua en `timerunners.es`.
- Resultados publicados como **PDFs estáticos** en `https://timerunners.es/resultados/{nombre}.pdf`.
- Hardware MYLAPS BibTag (compartido con muchas carreras populares).
- **No hay API pública** ni endpoint AJAX.

### Cómo lo cubrimos ahora
- **Adapter PDF genérico** (sep 2026): el admin añade manualmente las
  carreras con `scraperAdapter: "pdf"` y `resultsUrl` apuntando al PDF.
- El parser vive en un endpoint de Vercel (`/api/pdf/parse`) que descarga
  el PDF, lo extrae con `pdf-parse`, busca el dorsal y devuelve tiempo +
  nombre.
- Convex no puede bundlear `pdf-parse` (necesita `fs`/`http` nativos) ni
  `pdfjs-dist` (canvas / structuredClone con transfer), por eso el parser
  se hostea en Vercel que sí tiene Node.js completo.
- **Test E2E validado** contra Fuencarral 2012: 4/4 dorsales OK (1414,
  934, 1751, 99999→null).
- **Cobertura ampliable a**: Gesconchip, CronoChip y cualquier cronometrador
  que publique PDFs con formato `Dorsal Nombre Marca` (el más común en
  España).

### Limitaciones
- El admin tiene que añadir las carreras a mano (no hay catálogo público
  scrapeable).
- PDFs escaneados (sin texto extraíble) no funcionan — habría que añadir
  OCR.
- El formato del PDF varía: si Time Runners cambia la estructura de
  columnas, hay que ajustar el regex.

---

## 5. CronoChip (Valencia) — ❌ NO VIABLE

**Cobertura**: carreras populares de la Comunidad Valenciana, Murcia y
Alicante. Hardware Timingsense CHIP.

### Estado actual
- Web en `cronochip.com` sin endpoint AJAX ni API pública.
- Resultados publicados en HTML estático o PDF, sin estructura consistente.
- No hay manera programática de obtener "dorsal → tiempo" desde HTML.

### Cómo lo cubrimos
- **Adapter PDF genérico** (mismo que Time Runners) si publican PDFs.
- Para HTML, todavía no hay adapter (regex difícil por inconsistencia).

---

## 6. Gesconchip (Cataluña) — ✅ ADAPTER PDF GENÉRICO

**Cobertura**: carreras populares de Cataluña. Hardware ChampionChip /
MYLAPS.

### Estado actual
- Web estática, sin API.
- Hardware MYLAPS ya descartado para scraping directo (necesita API key).
- **Si publican PDFs con clasificaciones**, el adapter PDF genérico
  (ver §4) los cubre.

---

## 7. MYLAPS Speedhive (general) — ❌ NO VIABLE

### Por qué no
- Requiere API key (gratuita para algunas cuentas, pero con onboarding).
- Acepta términos legales (NDA implícito al usar la API).
- No es scraping: cualquier integración sería formal.
- Cubre los mismos eventos que Time Runners, Gesconchip, etc.

**Decisión**: descartado por privacidad/complejidad. Si en el futuro
mi-dorsal quiere cobertura premium, se puede explorar como integración
oficial con MYLAPS, no como scraping.

---

## Cobertura final de mi-dorsal (sep 2026)

Con los adapters de **Sportmaniacs** + **ChipLevante** + los originales
(RFEA, FEDME, ITRA, Runedia, Correbirras), la cobertura incluye:

- ✅ Grandes maratones y medias nacionales (vía Sportmaniacs)
- ✅ Carreras populares locales en toda España (vía Sportmaniacs)
- ✅ Carreras populares de Levante (Alicante, Murcia, Valencia, Albacete) con adapter dedicado (ChipLevante)
- ✅ Carreras federadas oficiales (RFEA, FEDME)
- ✅ Carreras internacionales (ITRA)
- ✅ Catálogo manual / otras fuentes (Correbirras, Runedia)
- ❌ Rock 'n' Roll Madrid Maratón y similares (Time Runners)
- ❌ Carreras de Cataluña no presentes en Sportmaniacs (Gesconchip)

**Estimación**: >80% del running popular español está cubierto. Las
excepciones son casos puntuales que pueden añadirse manualmente con
`officialUrl` apuntando a la web del organizador.

---

## 8. Investigación de nuevas fuentes (2026-09-21) — motivada por gap geográfico vs dorsal.pro

**Contexto**: comparación de cobertura contra el sitemap público de
`dorsal.pro` mostró solo ~7.9% de solapamiento con el catálogo de
mi-dorsal. El gap se concentra en Madrid, Cataluña, Baleares, País Vasco
y La Rioja — zonas donde mi-dorsal depende de Sportmaniacs pero no tiene
fuente dedicada (a diferencia de ChipLevante para Levante).

| Candidato | Tipo | Estado |
|---|---|---|
| **Federación de Atletismo de Madrid (FAM)** | Export Excel público (Joomla `mod_calendario`) | ✅ **Viable, calendario completo confirmado** |
| **Federació Catalana d'Atletisme** (`fcatletisme.cat`, no `atletisme.cat`) | WordPress, PDFs de calendario por modalidad | ✅ **Viable, PDFs reales confirmados** (ruta, trail, marxa, 5K/10K/mitja) |
| **Euskadiko Atletismo Federazioa / Federación Vasca** (`fvaeaf.org`) | AJAX plugin WP Full Calendar, JSON | ✅ **Viable, endpoint JSON confirmado** — pero volumen bajo (43 eventos totales, solo 4 carreras populares reales; resto son campeonatos federados internos) |
| **Federació d'Atletisme de les Illes Balears** (`faib.es`) | HTML server-rendered con datos estructurados por evento | ✅ **Viable, estructura limpia confirmada** (isla, modalidad, fecha, nombre) — paginación/rango de fechas sin resolver aún |
| **Federación Riojana de Atletismo** (`fratletismo.com`) | HTML plano, calendario histórico por temporada | ⚠️ **Viable técnicamente pero volumen casi nulo** — casi todo son campeonatos/pruebas escolares, apenas 1 carrera popular visible ("100 Popular") |
| **RockTheSport** | Portal de inscripciones (Next.js SSR) | ⚠️ Sin API pública detectable — el listado se resuelve server-side, sin endpoint AJAX visible en el HTML/bundle client-side |
| Cronomatic, Chronoruns, DeporSite, Correcamins.cat | — | ❌ Descartados: dominios inexistentes o (DeporSite) es software de gestión de centros deportivos, no de carreras |

**Nota de sesión 2026-09-21 (continuación)**: los dominios de estas
federaciones NO se encuentran adivinando variantes (`atletismo.eus`,
`atletismobalear.org`, etc. — todos fallan DNS). Se localizaron los
correctos a través de la página `/enllacos/` (enlaces) de la propia web
de la Federació Catalana d'Atletisme, que lista todas las federaciones
autonómicas hermanas. Ruta útil para el futuro si aparece una autonomía
nueva que investigar: `https://fcatletisme.cat/enllacos/`.

### 8.1. Federación de Atletismo de Madrid (FAM) — ✅ VIABLE

**Cobertura**: calendario oficial de atletismo de la Comunidad de Madrid
(competiciones federadas + carreras populares que homologan con la FAM).
Cubre exactamente la zona con mayor gap frente a dorsal.pro (32 carreras
sin match en la comparación).

**Endpoint público sin autenticación**:
```
GET https://www.atletismomadrid.com/component/ajax/?module=calendario&method=export&format=raw&module_id=205&season=2026&Itemid=111
```
- Devuelve un archivo **.xlsx** (`Content-Type:
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`),
  no JSON — es la exportación nativa de un módulo Joomla
  (`mod_calendario`, visible en `docProps/app.xml` del propio archivo:
  `<Application>Joomla mod_calendario</Application>`, `<Company>Federación
  de Atletismo de Madrid</Company>`).
- **Confirmado con contenido real**: ~369 filas para la temporada 2026,
  columnas `Fecha | Día | Fecha Fin | Día | Competición | Lugar | Tipo |
  Última modificación`. Ejemplos reales extraídos: "Ibercaja Madrid Corre
  por Madrid" (Madrid), "XVII Carrera Popular del Corazón" (Madrid Río),
  "Campeonato de Madrid de Clubes Absoluto" (Gallur).
- **Cómo se descubrió**: la página HTML normal `/calendario` (visitada
  como cualquier visitante) contiene un botón/enlace de "Exportar" que
  apunta a esa URL — no requiere inspeccionar bundle JS ni AJAX oculto,
  es un link visible en el DOM.
- **Columna "Tipo"** usa códigos de una letra sin diccionario visible
  todavía: en la muestra aparecen `D`, `S`, `AL`, `R`, `PC`, `V`, `M`,
  `O`, `J` — probablemente Día(D/S=sábado/domingo no, más bien
  Pista/Cross/PC=Popular Ciudad?), **pendiente de aclarar antes de
  mapear a `raceType` de mi-dorsal** (road/trail/mixed/obstacle). No
  asumir sin confirmar.
- **Parseo**: es un XLSX real (ZIP con `xl/worksheets/sheet1.xml`), sin
  `sharedStrings.xml` — usa inline strings (`<is><t>...</t></is>`), así
  que un parser tipo `xlsx`/`exceljs` en Node debe soportar ese modo (no
  todos los parsers ligeros lo hacen por defecto, verificar antes de
  escribir el ingest script).

**Siguiente paso si se prioriza**: escribir `scripts/ingest-fam-madrid.ts`
siguiendo el patrón de `ingest-rfea.ts` (descarga + parseo de un formato
tabular estático, no scraping HTML), mapeando `Lugar` → `locality`/
`province: "madrid"`, y decidiendo primero el mapeo de `Tipo`.

### 8.1bis. Federació Catalana d'Atletisme — ✅ VIABLE

**Dominio correcto**: `fcatletisme.cat` (NO `atletisme.cat`, que no resuelve
de forma útil).

**Cobertura**: calendario oficial catalán, publicado como PDFs separados
por modalidad, todos en `fcatletisme.cat/wp-content/uploads/2026/`:
- `calendari-ruta2026.pdf` (confirmado real: PDF v1.7, 3 páginas, 52KB)
- `calendari-trail2026.pdf`
- `calendari-marxa2025-26.pdf` (marcha atlética)
- `calendari-cros2026-27.pdf`
- `calendari-airelliure2025-26.pdf` (aire libre / pista)
- `lligacurses5km2026.pdf`, `lligacurses10km2026.pdf`, `lligacursesmm2026.pdf`
  (ligas de carreras por distancia — probablemente el listado más útil
  para carreras populares específicamente, ya segmentado por 5K/10K/media)

**Cómo se descubrió**: enlaces `<a href>` directos y visibles en el HTML
normal de la home (`grep href` sobre `curl` plano, sin JS) — no hace falta
inspeccionar bundle ni AJAX, es un WordPress con PDFs subidos a
`wp-content/uploads/`. Los nombres de archivo siguen un patrón anual
predecible (`calendari-{modalidad}{año}.pdf`), lo que sugiere que la URL
del año siguiente será adivinable sin tener que re-scrapear la home cada
vez (a confirmar cuando llegue 2027).

**Siguiente paso si se prioriza**: escribir un parser de PDF (reutilizar
el patrón de `pdf-parse` ya usado para RFEA/Time Runners) sobre
`lligacurses5km2026.pdf` / `10km` / `mm` (media maratón) primero, porque
esas tres son las que más se acercan a "carrera popular" en el sentido
que interesa a mi-dorsal — el resto (cros, marxa, aire libre) son
disciplinas de pista/campo a través más orientadas a federados.

---

### 8.1ter. Euskadiko Atletismo Federazioa / Federación Vasca de Atletismo — ✅ VIABLE (bajo volumen)

**Dominio correcto**: `fvaeaf.org` (los intentos previos —`atletismo.eus`,
`euskadikoatletismofederazioa.eus`, etc.— todos fallan DNS).

**Endpoint AJAX público confirmado, sin autenticación**:
```
GET https://fvaeaf.org/wp-admin/admin-ajax.php?action=WP_FullCalendar&start=2026-01-01&end=2026-12-31
```
- Devuelve JSON: `[{title, color, start, end, url, post_id, nonce}, ...]`
  — plugin estándar de WordPress "WP Full Calendar", el patrón
  `admin-ajax.php?action=WP_FullCalendar` es genérico del plugin, no
  específico de este sitio (útil si aparece en otra federación con el
  mismo plugin).
- **Confirmado con contenido real**: 43 eventos en el rango probado
  (2026 completo). **Solo 4 tienen pinta de carrera popular** (el resto
  son campeonatos de Euskadi internos — clubes, lanzamientos, pista).
  Ejemplos reales: "MEDIA MARATON DEL BIDASOA Y 10K", "BASAURIKO HERRI
  LASTERKETA VIII" (Basauri, incluye maratón/media/10K/5K).
- No requiere headers especiales (`X-Requested-With` no fue necesario en
  la prueba, aunque es buena práctica incluirlo).

**Limitación real**: bajo volumen de carreras populares puras — esta
federación parece centrarse en competición federada, no en agregar el
calendario de carreras populares de la región (a diferencia de la FAM de
Madrid o la catalana). Cubre el hueco de San Sebastián/Bidasoa
parcialmente (Behobia-San Sebastián casi seguro no está aquí, la
organiza el club Behobia directamente, no la federación), pero no
resuelve todo el hueco de Bilbao/Vitoria/País Vasco visto en la
comparación contra dorsal.pro.

---

### 8.1quater. Federació d'Atletisme de les Illes Balears (FAIB) — ✅ VIABLE

**Dominio correcto**: `faib.es` (variantes como `atletismobalear.org`
fallan DNS).

**Estructura**: NO es una API JSON, es HTML server-rendered en
`faib.es/competicions/` con datos ya estructurados por evento — cada
carrera es un bloque `<div class="event_prova" data-evento-id="...">`
con fecha (`event-date="dd/mm/yyyy"`), nombre, enlace a detalle
(`/competicions/{id}`), isla (`illa_prova`: ej. "Eivissa") y modalidad
(`modalitat_prova`: ej. "Ruta").

**Confirmado con contenido real**: 11 eventos visibles en la carga
inicial de la página, ejemplo real: "XVIII Cursa Popular Pla de Sant
Mateu" (Eivissa, modalidad Ruta, 27/09/2026).

**Sin resolver en esta sesión**: la página tiene un botón "Descarregar
Calendari en Excel" (`id="excel-download"`, clase
`excel-calendar-export`) que sugiere un export similar al de la FAM de
Madrid, pero dispara JS/POST en vez de ser un link `<a href>` directo —
no se pudo confirmar la URL del export sin ejecutar JS real (Network tab
en navegador, no solo `curl`). Tampoco se confirmó cómo pedir un rango de
fechas mayor que la vista inicial (¿paginación AJAX? ¿parámetro de
query no probado?). **Si se prioriza, el siguiente paso es inspeccionar
con un navegador real** (Playwright/DevTools) qué petición dispara el
botón de exportar Excel.

---

### 8.1quinquies. Federación Riojana de Atletismo — ⚠️ viable pero volumen casi nulo

**Dominio correcto**: `fratletismo.com`.

**Estructura**: HTML plano server-rendered en `/competiciones`, calendario
histórico organizado por temporada (`class="competicion clearfix invierno
2025/2026"`), sin AJAX ni API — fácil de parsear con un scraper HTML
simple si se prioriza.

**Contenido real observado**: la lista de eventos es casi enteramente
campeonatos federados y pruebas escolares ("Cto de La Rioja de Cross",
"Jornada Escolar", "Pruebas Combinadas"). Solo se identificó **una**
entrada con pinta de carrera popular genuina ("100 Popular"). Coherente
con que La Rioja es la región más pequeña de las investigadas — no
sorprende que aporte poco volumen. **Prioridad baja** frente a las otras
tres fuentes de esta sección.

---

### 8.2. RockTheSport — ⚠️ sin API pública detectable (esta sesión)

Portal de inscripciones/descubrimiento de eventos (`web.rockthesport.com`,
Next.js). El listado por deporte (`/es/sport/running`) carga contenido
vía Server Components — no se detectó una llamada `fetch`/AJAX propia
desde el cliente ni un endpoint tipo `/api/` en el bundle JS inspeccionado.
El único patrón de URL público es el buscador
(`/es/allEvents?pattern={term}`), que es HTML renderizado en servidor,
no una API estructurada. **No descartado del todo** — si se prioriza,
requeriría inspección más profunda (Network tab en navegador real,
no solo curl+grep sobre el HTML estático) para confirmar si existe un
endpoint interno de Next.js Server Actions o RSC payload parseable.

### 8.3. Búsquedas bloqueadas — limitación de esta sesión, RESUELTA sin buscador

`WebSearch` (herramienta nativa) devolvió error 400 en TODOS los intentos
de esta sesión y de la continuación, de forma consistente — parece un
fallo real de la herramienta, no puntual. Google/Bing/DuckDuckGo vía
`WebFetch` tampoco sirvieron (consent walls, CAPTCHA "select all squares
with a duck", o resultados desalineados de la query).

**Cómo se resolvió sin buscador**: adivinar dominios por intuición
(`atletismo.eus`, `atletismobalear.org`, `eaf.eus`, etc.) falló
sistemáticamente con DNS — ese enfoque no funciona para nombres de
federaciones autonómicas españolas, cuyos dominios reales no siguen un
patrón obvio (`fvaeaf.org`, `faib.es`, `fratletismo.com` no son
adivinables). La vía que sí funcionó: la Federació Catalana d'Atletisme
tiene una página `/enllacos/` que lista sus federaciones hermanas de
otras autonomías — es la fuente cruzada más fiable para este tipo de
descubrimiento, y probablemente sirva para las autonomías que aún faltan
(Galicia, Canarias, Extremadura, Castilla y León, etc., si en algún
momento se prioriza expandir más). Dominios confirmados en esta sesión:
`fcatletisme.cat`, `fvaeaf.org`, `faib.es`, `fratletismo.com`. **Si en el
futuro `WebSearch` sigue devolviendo 400, usar esta vía de enlaces
cruzados antes que adivinar dominios.**

---

## 9. Implementación de los 5 adapters nuevos (2026-09-21)

Las 5 fuentes de §8 se implementaron como scripts de ingest reales
(`scripts/ingest-{fam-madrid,fca-catalunya,faib-baleares,fva-euskadi,
fra-larioja}.ts`, registrados en `package.json` como `npm run
ingest:{slug}`), siguiendo el mismo patrón que `ingest-cruzandolameta.ts`
(fetch de la fuente pública → parseo → `systemUpsert` idempotente vía
`ConvexHttpClient`, con auto-creación de su `dataSource` si no existe).

**Resultado real de la primera ejecución** (catálogo pasó de 2.708 a
**2.773 carreras**, +65 nuevas):

| Fuente | Futuras encontradas | Creadas | Actualizadas |
|---|---|---|---|
| FAM (Madrid) | 13 | 11 | 2 |
| FCA (Catalunya, solo ruta) | 22 | 21 | 1 |
| FAIB (Baleares) | 35 | 33 | 2 |
| FVA (Euskadi) | 2 (ambas ya pasadas) | 0 | 0 |
| FRA (La Rioja) | 0 (todas ya pasadas este año) | 0 | 0 |

Euskadi y La Rioja no aportaron carreras en esta ejecución porque su
temporada 2026 restante ya casi ha pasado y aún no publican calendario
2027 (confirmado: `--year=2027`/`--season=2027` en ambos adapters
devuelve 0 filas) — **no es un fallo del adapter**, es estacionalidad. Se
recomienda re-ejecutar estos dos concretamente cuando avance el año.

**Detalles de implementación por fuente:**

- **FAM (Madrid)**: parsea el XLSX con el paquete `xlsx` (`npm install
  xlsx`, no estaba instalado). Filtra columna `Tipo` a `R` (Ruta) y
  `TR/MT` (Trail/Montaña) — descarta pista, cross, marcha, jornadas
  escolares. Fallback de provincia: `"madrid"` salvo que la localidad
  aparezca con un paréntesis de otra provincia conocida (ej. "Cieza
  (Murcia)").
- **FCA (Catalunya)**: solo cubre el PDF de **ruta** por ahora
  (`calendari-ruta2026.pdf`). El PDF de **trail** tiene un formato de
  texto distinto (especialidad+lugar pegados sin código de homologación
  como ancla) — queda como TODO explícito en el script, no implementado.
  Las ligas por distancia (`lligacurses5km/10km/mm2026.pdf`) son rankings
  de corredores, no calendarios — descartadas como fuente de carreras
  (solo listan carreras homologadas de forma indirecta en la última
  columna de cada tabla de puntuación, demasiado frágil para parsear).
  **Limitación de parseo aceptada**: cuando el día de la carrera es de 1
  cifra y el nombre empieza también por un número (ordinal de edición
  pegado, ej. "1" + "42a Mitja Marató..."), el día puede desviarse en un
  dígito — se prioriza la interpretación con día válido (1-31); el dedup
  de `systemUpsert` por nombre+fecha absorbe una re-ingesta futura si se
  corrige.
- **FAIB (Baleares)**: el parámetro GET `mes=tots` (visto en el `<select
  name="mes">` del formulario HTML) trae los ~217 eventos del año de
  golpe, no hace falta iterar mes a mes. Filtra por clase CSS
  `only-popular`/`content-popular` (descarta `has-end-date`, que son
  ligas/circuitos sin fecha única) y por `modalitat_prova` = Ruta/Trail.
  Mapea isla → provincia (`mallorca`, `menorca`, `ibiza`; Formentera se
  mapea a `ibiza` por ser el fallback administrativo más cercano en el
  schema actual, que no tiene provincia "formentera" propia).
- **FVA (Euskadi)**: sin campo de "tipo" en el JSON, se filtra por
  heurística de nombre (palabras de distancia/carrera vs. palabras de
  campeonato federado interno). Fallback de provincia fijo a `"gipuzkoa"`
  porque las carreras populares reales conocidas de esta fuente están en
  esa zona (Bidasoa) — revisar si en el futuro aparecen carreras de
  Bizkaia/Araba.
- **FRA (La Rioja)**: mismo patrón heurístico que FVA. El listado HTML
  trae TODO el histórico desde la temporada 2011/2012 (799 bloques en
  total) — el filtro por fecha futura hace el resto, no hace falta paginar.

**Qué falta si se quiere ampliar más esta ronda** (no bloqueante, ideas
para otra sesión):
1. Parser del PDF de trail catalán (formato distinto al de ruta).
2. Re-ejecutar FVA y FRA cuando avance la temporada 2027.
3. Revisar si el género/categoría de las carreras de liga catalanas
   (`lligacurses*.pdf`) se puede aprovechar de otra forma (no como fuente
   de calendario, pero quizá para verificar homologación de carreras ya
   existentes).
