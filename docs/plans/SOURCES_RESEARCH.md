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
