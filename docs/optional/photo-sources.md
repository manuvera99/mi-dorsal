# Fuentes de fotos de carreras populares en España

> **Estado:** investigación de proveedores hecha sep 2026; **re-revisado y
> ampliado 15 sep 2026** tras cerrar Sprint 0+1 y, en la misma sesión,
> investigar y descartar/implementar la mayoría de candidatos de esta
> lista con datos reales (ver §0 y §7).
> **Propósito:** inventario de proveedores que alojan galerías de fotos de
> carreras populares españolas, con URLs reales verificadas, para evaluar
> cuáles pueden integrarse en la feature "Encuentra tus fotos" descrita en
> `docs/plans/PHOTO_SEARCH_TECH.md` y `docs/plans/PHOTO_SEARCH_PRD.md`.
> **Adapters de FOTOS reales hoy: Flickr, ChipLevante y Grupo Brotons**
> (los tres en producción, ver §0). El resto de proveedores de esta lista
> han sido investigados y en su mayoría **descartados con datos reales**
> (§3.1, §3.1.3, §7.1) — no por falta de tiempo, sino porque no se
> sostenían al verificarlos contra el catálogo real de mi-dorsal.

---

## 0. Estado real de la feature (actualizado 15 sep 2026)

| Pieza | Estado |
|---|---|
| Pipeline InsightFace+EasyOCR+Matcher | ✅ Producción |
| Endpoint FastAPI en Modal (`manuvera08--photo-search-api-fastapi-app.modal.run`) | ✅ Producción |
| Descarga con backoff adaptativo compartido entre álbumes (`AdaptiveRateLimiter`) | ✅ Producción |
| Source adapter Flickr | ✅ Producción |
| Source adapter ChipLevante (con atajo por dorsal, ver §3.1) | ✅ Producción (15 sep 2026) |
| Source adapter Grupo Brotons (Alicante/Benidorm/El Campello, ver §3.1) | ✅ Producción (15 sep 2026) |
| Caché persistente de álbumes entre búsquedas (Modal Volume) | ✅ Producción (15 sep 2026) |
| Alerta si Flickr rompe la extracción del `site_key` público | ✅ Producción (15 sep 2026) |
| Schema Convex `photoSearchJobs` | ✅ Producción |
| UI Next.js (`/perfil/fotos`, selector de álbumes de perfil, hasta 3 álbumes) | ✅ Producción |
| Convex mutations + scheduled actions | ✅ Producción |
| Email "photos_found" | ✅ Producción |
| Gate Pro + límite de fotos por job (`MAX_PHOTOS_PER_JOB=1500`) | ✅ Producción |
| API key propia de Flickr (vs. `site_key` público reutilizado) | ⏸️ Aplazado — exige cuenta Flickr Pro (82€/año), se revisita cuando la feature facture |
| Source adapter Sportmaniacs | ❌ **Descartado** (15 sep 2026) — ver §3.1, campo `photos.sm` existe en su API pero 0 de 71 carreras reales muestreadas (incluyendo maratones grandes) tenían `has_photos: true` |
| Source adapters Masatletismo/FDMValencia/A Coruña/etc. | ❌ No investigado con datos reales todavía — ver §7.1 |

**Dato real del catálogo (medido 15 sep 2026, `npx convex run --inline-query` sobre `races`):**

| `scraperAdapter` | Nº carreras | % del catálogo |
|---|---|---|
| sportmaniacs | 2162 | 81.5% |
| correbirras | 231 | 8.7% |
| carreraspopulares | 117 | 4.4% |
| chiplevante | 113 | 4.3% |
| itra | 8 | 0.3% |
| atletismorfea | 7 | 0.3% |
| runedia | 5 | 0.2% |
| fedme | 5 | 0.2% |
| pdf / none | 4 | 0.2% |
| **Total** | **2652** | 100% |

**De esas 2652 carreras, solo 1 tiene `races.photosUrl` configurado** (un
enlace a Flickr, pegado a mano por el admin). Esto confirma la lectura de
§7 de más abajo: **la cobertura real de "fotos encontrables" hoy es
prácticamente 0%** — no porque Flickr no funcione, sino porque casi
ninguna carrera del catálogo tiene su álbum enlazado todavía. Antes de
invertir en un adapter nuevo (Sportmaniacs, ChipLevante...), el cuello de
botella real es **enlazar álbumes existentes**, no **soportar más
proveedores**. Ver recomendación en §7.

---

## 1. Por qué este doc existe

El estado actual del feature (ver §0 arriba) tiene **un único source
adapter de FOTOS funcional** (`FlickrSource`). Para ampliar la cobertura a
más carreras del catálogo — y potencialmente competir con proveedores que
ya ofrecen "búsqueda por selfie" — antes hay que saber:

1. **Quién publica fotos de carreras en España** (regional vs nacional).
2. **Cómo de accesible es cada fuente** (API pública, HTML scrapeable, paywall,
   link-out).
3. **Qué patrón técnico encaja** con la arquitectura existente
   (`PhotoSource` + `get_source_for_url()` en `findmyrace/sources/`).
4. **Riesgos legales/operativos** (RGPD — especialmente para la capa de
   detección facial descrita en `docs/optional/face-search-architecture.md`).

> ⚠️ **Decisión estratégica (PHOTO_SEARCH_PRD §1, nota del 13 sep 2026):**
> al menos un proveedor del propio catálogo de mi-dorsal — **fotoscarreras.com**
> (Benidorm Half) y **QuieroMisFotos.com** (Mitja Marató Santa Pola) — ya
> ofrece "sube tu selfie" con reconocimiento facial propio. El
> diferenciador real no es "ser los primeros en hacerlo", sino **cubrir el
> nicho de carreras pequeñas/locales que suben sus fotos gratis a Flickr y
> donde nadie ofrece búsqueda por selfie**. Este doc clasifica qué fuentes
> caen en ese nicho.

---

## 2. Taxonomía de fuentes

| Tipo | Características | Coste integración | Ejemplos |
|---|---|---|---|
| **API pública** | JSON, REST, sin auth o con site_key público | Bajo (1-3 días por fuente) | Sportmaniacs |
| **HTML scrapeable** | Página estática con URLs de fotos en `<a>` / `<img>` | Bajo-medio (1-2 días) | ChipLevante, Masatletismo, Subida Pico Veleta |
| **Bucket S3 / CDN público** | URLs estables tipo `s3.region.amazonaws.com/...` | Muy bajo | Sportmaniacs (PDFs y fotos) |
| **Plataforma vertical cerrada** | Producto comercial con búsqueda dorsal/facial; sin API pública | Solo **link-out** (no scraping) | FindUpix, Sport-Visual, Persígueme, Foto Sport Eventos, BuscoDorsal, Rhino Photo Sport, Cano Foto Sports, Top Time "Time Photo" |
| **B2B partner (API documentada)** | Producto con API para integradores; suele requerir cuenta | Medio + coste anual | **SportPXL Vision API**, SportPXL como partner |

---

## 3. Inventario de proveedores verificados

### 3.1. Con API pública o bucket público — viables como adapter

#### Sportmaniacs (Localbi/Evide) — ❌ DESCARTADO (15 sep 2026, datos reales)
- **Bucket S3 público** con PDFs y fotos por raceId:
  `https://s3.eu-west-1.amazonaws.com/sm-fotos.sportmaniacs.com/...-{raceId-GUID}-...`
- **API de rankings pública** devuelve `photos.sm` por participante en el JSON:
  `https://sportmaniacs.com/en/races/rankings/{raceId}`
  Header necessário: `X-Requested-With: XMLHttpRequest`.
- **API de inscritos** (documentada en `docs/plans/PHOTO_SEARCH_TECH.md`):
  `POST https://api.copernico.cloud/race-registrations/{raceId}`
- **Detalle técnico:**
  `docs/plans/PHOTO_SEARCH_TECH.md` §15.6 (incluye rate-limit real y
  mitigaciones), `docs/plans/SOURCES_RESEARCH.md` §1 (adapter ya en
  producción para **resultados por dorsal**, no para fotos).
- **`races.sportmaniacsEventIds`** (ver `convex/schema.ts`) ya está poblado
  para las 2162 carreras con `scraperAdapter === "sportmaniacs"` — el UUID
  de evento real ya está cacheado desde el backfill de resultados, así que
  técnicamente esta fuente sí tendría el efecto de "un despliegue, cobertura
  masiva instantánea" que ninguna otra fuente de esta lista tiene.
- **✅ Verificado con datos reales, ❌ descartado en la práctica:** el campo
  `photos.sm` / `has_photos` SÍ existe en la API (confirmado contra
  `https://sportmaniacs.com/en/races/rankings/{eventId}`, campo
  `Race.has_photos` y `Rankings[].photos.sm`), pero **0 de 71 carreras
  reales muestreadas** (incluyendo maratones grandes como Ibiza Marathon
  2025, y muestreo aleatorio de 50 carreras más entre las 949 con
  `sportmaniacsEventIds` cacheado) tenían `has_photos: true` — todas
  devolvían un avatar genérico placeholder (`avatar_boy.png`,
  `defaultImage: true`), no una foto real. La función existe en la
  plataforma de Sportmaniacs pero prácticamente ningún organizador la usa.
- **Veredicto:** ❌ **Descartado.** Construir `SportmaniacsPhotoSource` daría
  cobertura real ≈0% hoy, pese a la promesa teórica del 81.5% del catálogo.
  Revisitar solo si se confirma que algún organizador grande la activa en
  el futuro — el coste de detectarlo (una llamada extra al ranking por
  búsqueda) no compensa mientras la tasa de adopción real sea esta.

#### ChipLevante (Levante: Alicante, Murcia, Albacete, Cuenca, Castellón) — ✅ EN PRODUCCIÓN (15 sep 2026)
- **HTML scrapeable** en la ficha de cada carrera:
  `https://www.chiplevante.com/es/prueba/{slug}-{evento}-{edicion}`
- **Histórico legacy:**
  `http://www.chiplevante.net/{YEAR}{NOMBRECARRERA}/clasificaciones.asp`
- **Estado del adapter de resultados:** `scraperAdapter: "chiplevante"`
  ya en producción (`docs/plans/SOURCES_RESEARCH.md` §2, 113 carreras).
- **Adapter de fotos implementado y desplegado** —
  `findmyrace/sources/chiplevante.py`, `ChipLevantePhotoSource`. Endpoint
  real descubierto (no el `FOTODIPLOMA` que asumía una versión anterior de
  este doc): `POST /modulos/inc/dame_mm.php` con `{ev, ed, cr, pc:"0",
  tp:"I", dr, ti:"", pag}` — sirve tanto el álbum general paginado (24
  fotos/página, confirmado real: 513 fotos en 22 páginas para una carrera)
  como un atajo por dorsal (`dr=<dorsal>`), porque ChipLevante ya asocia
  fotos a dorsales cruzando tiempo de cronometraje + marca de tiempo de
  cámara — sin necesidad de nuestro pipeline de cara/OCR en ese caso.
  Confirmado con 40 carreras reales muestreadas: 77.5% tenían fotos
  activadas (`configuracion_cert` con el flag de fotos en `1`).
- **Veredicto:** ✅ **Ya implementado.** Ver commit "feat(sources): adapter
  de fotos para ChipLevante" (find-my-race) y "feat(photo-search): soporte
  para álbumes de ChipLevante" (mi-dorsal), 15 sep 2026.

#### Grupo Brotons (Alicante/Benidorm/El Campello) — ✅ EN PRODUCCIÓN (15 sep 2026)
- Organizador real (no agregador) de carreras populares/solidarias de la
  zona de Alicante — confirmado en `officialUrl` de 5-6 carreras del
  catálogo, pero con **47 álbumes de fotos reales** en su índice
  (`grupobrotons.com/fotografias/`), muchos correspondientes a eventos del
  catálogo que hoy no tienen ese enlace vinculado en `officialUrl` (p. ej.
  "Elche Carrera contra el Cáncer de Páncreas", con hasta 3 álbumes
  distintos del mismo evento).
- **Más simple que ChipLevante**: galería propia con plugin **NextGEN
  Gallery de WordPress**, HTML estático **sin JS ni sesión** — a
  diferencia de ChipLevante (que exige cookie de sesión) o Flickr (API
  REST), aquí el HTML de la propia página del álbum ya trae los `<a
  href>` a las fotos de tamaño completo. Patrón:
  `grupobrotons.com/fotografias/nggallery/album/{slug}[/page/N]`.
  Confirmado con un álbum real: 370 fotos únicas en 4 páginas
  (100+100+100+70), fin de paginación cuando una página no devuelve
  ninguna foto.
- La ficha de un evento **no enlaza directamente a su álbum** — solo al
  índice general. El usuario tiene que pegar la URL del álbum concreto,
  igual que ya hace con Flickr/ChipLevante.
- **⚠️ Hallazgo de infraestructura, no solo de este proveedor**: el
  servidor sirve `Content-Encoding: br` (Brotli). Sin el paquete `brotli`
  instalado, `requests` devuelve el body comprimido tal cual dentro de
  `resp.text`, **sin lanzar ninguna excepción** — la búsqueda de fotos
  fallaba en silencio (0 resultados, indistinguible de "sin fotos") hasta
  detectarlo comparando el tamaño real de la respuesta (18KB comprimido
  vs. 210KB real). Corregido añadiendo `brotli` como dependencia en los
  tres sitios que instalan paquetes Python de este proyecto
  (`photo-search-api/pyproject.toml`, `requirements.txt`,
  `modal_app.py`, y también `find-my-race/pyproject.toml`+
  `requirements.txt` por el mismo motivo) — relevante para cualquier
  adapter futuro contra un servidor que también use Brotli.
- **Veredicto:** ✅ **Ya implementado.** Ver
  `findmyrace/sources/grupobrotons.py`, `GrupoBrotonsPhotoSource`.

#### Masatletismo — ❌ DESCARTADO (15 sep 2026, datos reales)
- **Media library WordPress estándar, galería SÍ real** (a diferencia de
  Sportmaniacs): confirmado con la carrera de ejemplo, ~150 `<img>` reales
  servidos vía `i0.wp.com/masatletismo.com/wp-content/uploads/...jpg`.
- **⚠️ Error corregido en este doc:** la versión anterior lo describía como
  "Federación Atletismo Castilla y León" — **incorrecto**. Verificado
  contra la home real: Masatletismo cubre **Córdoba/Andalucía**, no
  Castilla y León (la confusión venía de que la carrera de ejemplo, Subida
  al Pico Veleta, es en Granada — Andalucía, no CyL).
- **Volumen real insuficiente:** el catálogo de mi-dorsal tiene solo **6
  carreras en la provincia de Córdoba**, todas con `scraperAdapter`
  distinto (sportmaniacs/carreraspopulares) — ninguna vinculada a
  Masatletismo como fuente. Masatletismo es un medio editorial que cubre
  los eventos que decide cubrir, no la fuente oficial de esas carreras;
  no hay campo en el catálogo que confirme cobertura real sin comprobar
  carrera por carrera.
- **Veredicto:** ❌ **Descartado por volumen**, no por viabilidad técnica
  (la galería SÍ es real y scrapeable). 6 carreras candidatas no
  justifican ~1-2 días de desarrollo — mismo criterio que descartó
  Sportmaniacs (verificar cobertura real antes de invertir), aplicado
  aquí al volumen en vez de a la existencia de fotos.

#### FDM Valencia — ❌ DESCARTADO (15 sep 2026, datos reales)
- **La "galería" no es tal**: verificado contra
  `carreras.fdmvalencia.es/es/fotos-carreras-populares-valencia/` — cada
  enlace "Ver" de cada carrera apunta al mismo perfil de Facebook
  (`facebook.com/carreraspopularesvalencia`), no a una página propia por
  carrera. Sin URL individual por evento, no hay nada que scrapear con un
  `PhotoSource` — y Facebook no es plataforma para scraping (política +
  viabilidad, mismo criterio que las plataformas cerradas de §3.2).
- **Veredicto:** ❌ **Descartado.** A pesar de que Valencia es la provincia
  con más carreras del catálogo (828, 31%), esta fuente concreta no tiene
  fotos propias que descargar.

#### A Coruña (Ayuntamiento) — ❌ DESCARTADO por volumen (15 sep 2026)
- **Galería federaciones locales**:
  `https://www.coruna.gal/carreraspopulares/es/galerias-de-fotos?argIdioma=es`
  — no se ha verificado si la galería en sí es real (a diferencia de FDM
  Valencia) porque no hace falta: el catálogo de mi-dorsal tiene solo
  **2 carreras** en la provincia de A Coruña. Volumen demasiado bajo para
  justificar la verificación siquiera.
- **Veredicto:** ❌ **Descartado por volumen**, sin necesidad de verificar
  la fuente en sí.

#### Subida Internacional Granada – Pico Veleta
- **Sección GALERÍA** en `subidaveleta.com` con colaboradores externos
  (Photodeportes, J.M.M.E., Pedro Montesinos, Pitufollow, DorsalCHIP).
- Cada enlace apunta a un álbum Flickr de un fotógrafo particular — útil
  como punto de partida, no como fuente propia.
- **Veredicto:** ⚙️ **Adaptable parcialmente**. Solo si los colaboradores son
  Flickr público; si no, son links externos a webs con sus propias políticas.

---

### 3.1.2. Ronda de investigación por dominio real (`officialUrl`) — 15 sep 2026

Tras confirmar Flickr/ChipLevante/Grupo Brotons, se revisaron los
dominios reales de `race.officialUrl` con más carreras del catálogo que
aún no tenían veredicto (top ~30 por volumen, más una comprobación
cruzada con `registrationUrl`/`resultsUrl`). Resumen — detalle completo
de cada uno en los apartados anteriores o abajo según el caso:

| Dominio | Carreras | Veredicto |
|---|---|---|
| alcanzatumeta.es | 50 | ❌ Plataforma de inscripción/resultados, sin fotos ni link-out, confirmado en una carrera real |
| deportes.dipualba.es | 20 | ✅ **Palanca B** — enlaza directamente a un perfil real de Flickr (24+ álbumes), pero la ficha de cada carrera no enlaza al álbum concreto (solo al índice general `/home/fotos`) — requiere catalogar manualmente qué álbum corresponde a qué carrera |
| babelsport.com | 14 | ❌ Plataforma de inscripción pura, sin fotos, confirmado en un evento futuro y uno celebrado |
| atletaspopulares.es | 12 | ⚠️ No concluyente — el dominio bloqueó las peticiones de investigación repetidamente; pendiente de revisar con más cuidado si se decide invertir tiempo |
| lineadesalida.net | 11 | ❌ Organizador real, pero sin galería propia — enlaza puntualmente a Google Photos solo cuando el organizador lo añade a mano, sin patrón sistemático. Ya cubierto por el link-out de Google Photos existente |
| grupobrotons.com | 6 en `officialUrl`, 47 álbumes reales | ✅ **Implementado** (ver §3.1) |
| carreraspopularesalmeria.com | 8 | ⚠️ No concluyente — tiene sección "GALERÍA"/"Fotografías" en el menú pero aparece vacía en el HTML estático (puede requerir JS); las inscripciones reales van vía Cruzando la Meta |
| dorsal21.com | 7 | ❌ Cronometrador RFEA puro, sin ninguna mención de fotos |
| correpormurcia.com | 6 | ❌ Reutiliza babelsport.com para inscripciones, sin nada propio |
| cruzandolameta.es / rankings.cruzandolameta.es | 0 en el catálogo hoy (adapter de resultados existe en `convex/scraper.ts` pero sin carreras pobladas todavía) | ❌ Sin evidencia de fotos en ninguna web relacionada (`almeriactiva.es`); SPA sin contenido en el HTML inicial |
| Facebook / Google Photos / Google Drive | 21 / 0 / 0 | Ver §3.1.3 |
| Google Maps (`goo.gl/maps`) | 9 | ❌ No es fotos — enlaces de recorrido/mapa en `mapUrl`/`mapEmbedUrl` |
| Dropbox / OneDrive / iCloud / Imgur | 0 cada uno | ❌ Sin presencia en el catálogo |
| Media Elche (mediaelche.es) | — | Enlaza a Facebook + Flickr (`mikemanitasdpm`, ya conocido) + BuscoDorsal + ChipLevante — todo ya cubierto, sin adapter nuevo que aportar |
| Benidorm Half | — | Usa fotoscarreras.com (plataforma comercial cerrada, ya en §3.2) |
| Maratón Valencia | — | Sin galería propia visible — los grandes maratones suelen ir por proveedor comercial externo, no scrapeable |
| FEDME | 5 | ❌ Sin galería de fotos, solo "FEDME TV" (vídeo) |

**Pendiente si se retoma esta línea de investigación**: `atletaspopulares.es`
y `carreraspopularesalmeria.com` quedaron sin veredicto firme (bloqueos de
red / posible contenido cargado por JS) — repetirlos con un navegador
real (Playwright/Selenium) en vez de fetch simple antes de descartarlos
del todo.

---

### 3.1.3. Genéricos — link-out, salvo Drive (reconsiderar si aparece demanda real)

A diferencia de los proveedores anteriores (dominios propios de carreras/
cronometradores), estos son plataformas genéricas de terceros donde
organizadores comparten álbumes sueltos. Medido en el catálogo real de
mi-dorsal (15 sep 2026, `npx convex run --inline-query` sobre todos los
campos URL de `races` — `officialUrl`, `photosUrl`, `registrationUrl`,
`resultsUrl`, `rulesUrl`, `mapUrl`, `mapEmbedUrl`, `extractedFromUrl`,
`sourceUrl`, `organizerUrl` — más `description`/`longDescription` como
texto libre):

| Proveedor | Carreras en el catálogo |
|---|---|
| Facebook | **21** |
| Google Photos | **0** |
| Google Drive | **0** |

#### Facebook (álbumes de página/evento)
- Verificado: Meta prohíbe explícitamente scraping/extracción automatizada
  en sus Términos de Servicio, con enforcement legal activo (litigios
  recientes contra scrapers). Además, el contenido "público" de un álbum
  suele requerir JS pesado y a menudo un muro de login parcial incluso
  para visitantes no logueados.
- **Veredicto:** ❌ **Nunca scraping.** Implementado como **link-out**
  simple en la UI (`lib/photo-source-support.ts` +
  `app/perfil/fotos/[raceId]/client.tsx`, 15 sep 2026): si
  `race.photosUrl` es de Facebook, se muestra un botón "Abrir álbum" en
  vez de intentar precargarlo en el formulario de búsqueda por selfie
  (que el backend rechazaría con un 400 igualmente).

#### Google Photos (álbumes compartidos)
- Verificado con un enlace real (`photos.app.goo.gl/...` citado en
  correbirras.com): el HTML inicial de la página de álbum compartido solo
  trae 1 foto (la portada) — el resto carga por scroll infinito vía JS, no
  hay forma de listar el álbum completo sin ejecutar ese JS.
- La Google Photos Library API oficial exige **OAuth del propietario del
  álbum** para leer su contenido — no hay vía pública de solo lectura sin
  esa autorización, que no tenemos ni es viable pedir a cada fotógrafo.
- **Veredicto:** ❌ **Descartado técnicamente** (no solo por políticas).
  Link-out, igual que Facebook. Además, 0 carreras del catálogo lo usan
  hoy (tabla arriba) — sin caso de uso real ni aunque fuera viable.

#### Google Drive (carpetas compartidas) — ⚠️ técnicamente viable, sin demanda real hoy
- **Corrección respecto a una versión anterior de este doc**, que
  agrupaba Drive con Google Photos como "mismo problema estructural" —
  **incorrecto para Drive**, confirmado con una prueba real (15 sep 2026):
  una cuenta de servicio propia de Google Cloud (gratis, sin coste por
  este volumen), **sin ser añadida como colaboradora**, pudo listar
  (`files.list`) y descargar el contenido real (`files.get?alt=media`,
  HTTP 200) de una carpeta compartida solo como "Cualquiera con el enlace
  puede ver". Confirmado también por qué: una API key simple NO basta
  (Drive exige una identidad real para evaluar el ACL de cada archivo,
  ver `cloud.google.com/docs/authentication/api-keys` — *"a standard API
  key doesn't identify a principal"*), pero una cuenta de servicio SÍ
  tiene una identidad propia (email `@proyecto.iam.gserviceaccount.com`)
  que Drive evalúa exactamente igual que la de cualquier cuenta de Gmail
  que abriera el enlace a mano.
- **Pero: 0 de 2652 carreras del catálogo apuntan a Drive hoy** (tabla
  arriba) — a diferencia de Facebook (21) o de la promesa (no cumplida)
  de Sportmaniacs, aquí no hay ningún caso de uso real que mover.
- **Veredicto:** ⏸️ **Capacidad técnica confirmada, implementación
  aplazada por falta de demanda.** No es un descarte por inviabilidad —
  es la única de las plataformas genéricas que SÍ sería adaptable como
  fuente real de búsqueda (mismo patrón que Flickr: recurso público que
  cualquier identidad puede leer), pero construir el adapter hoy no
  tendría ningún efecto medible. Hoy tratado como **link-out**
  (`lib/photo-source-support.ts`, `google_drive` en
  `UNSEARCHABLE_DOMAIN_PATTERNS`) exactamente igual que Facebook/Google
  Photos — la diferencia es que aquí el link-out es una decisión
  temporal por falta de volumen, no un tope técnico. **Siguiente paso si
  aparece demanda real:** quitar `google_drive` de esa lista y construir
  `findmyrace/sources/google_drive.py` (`GoogleDrivePhotoSource`) con
  credenciales de cuenta de servicio guardadas como secret de Modal —
  no haría falta reinvestigar la viabilidad, ya está confirmada.

---

### 3.2. Plataformas verticales cerradas — solo **link-out** (no scraping)

Estas tienen producto comercial con búsqueda por dorsal y/o facial. Scrapearlas
no es ni legal ni rentable; tratarlas como **socios** es el camino real.

#### SportPXL (B2B + plataforma blanca) ⭐
- **API documentada** para integradores: `https://sportpxl.com/es/api-sportpxl-vision-2/`
- Modelos: `pip install`-equivalent, planes desde 24,90 €/año (1.000 fotos
  almacenadas), 99 €/año (5.000), 199 €/año (10.000), 399 €/año (30.000).
- **0% comisión** para organizador/fotógrafo en ventas.
- **Servidores UE certificados HDS**, soporte en español.
- **Reconocimiento facial (>94% precisión en condiciones óptimas) + dorsal + OCR + IA de derecho a la imagen.**
- **Cliente de referencia:** Maratón Vert de Rennes (gratuito para
  participantes).
- **Veredicto:** 🟢 **Modelo Partner**. Único viable para escalar a muchas
  carreras sin escribir pipeline propio. Decisión de negocio, no de código.

#### BuscoDorsal (Levante / Alicante / Murcia)
- **Web:** `https://buscodorsal.com/`
- 4 carreras activas documentadas (Media Maratón Elche, Elche Night Race,
  Serra Grossa Trail, Memorial JM Zambrana, Hyrace 2026, Maratón Elche
  Alicante, La Gran Carrera del Mediterráneo, Media Maratón Aguas de
  Alicante).
- Búsqueda por dorsal + facial opt-in (los eventos con "expediente aprobado"
  tienen facial opcional).
- **DPM (Deportistas Por Mí)** es el fotógrafo detrás.
- **Veredicto:** 🟢 **Contacto comercial**. Si quieres ser agregado por
  ellos, mínimo viable. Tienen URL por carrera-evento que puede añadirse
  como `kind: "partner_official"` en `racePhotoSources` (ver más abajo).

#### Acariciando la Luz / Lumepic (Murcia/Alicante) — investigado 16 sep 2026
- **Web:** `https://acariciandolaluz.com/galerias`
- Fotógrafo deportivo individual (no cronometrador ni agregador) — 10
  galerías reales vistas (Trail de Bolulla, Granja Run Fest, Trail
  Porticherlo de Pliego, Maximum Revolcadores, etc.), fotos servidas vía
  CloudFront, con botón "Comprar" (paywall, no gratuito).
- **Ya delega la búsqueda facial/dorsal en Lumepic**
  (`lumepic.com`) — plataforma comercial internacional de reconocimiento
  facial (clientes: Decathlon, Renault, Santander, Volkswagen), mismo
  perfil que SportPXL/BuscoDorsal pero de mayor escala. No estaba
  catalogada en este doc hasta ahora.
- **Endpoint técnico real confirmado** (reverse-engineering del bundle JS
  de Lumepic, 16 sep 2026 — sin usar credenciales ni saltarse ningún
  control de acceso, solo inspeccionando peticiones que el propio
  navegador ya hace sin login):
  `GET https://www.lumepic.com/api/feed/albums/{albumId}/photographs?pagination[skip]=N`
  — **sin autenticación**, devuelve `{items: [{id, url, thumbnailUrl,
  price, width, height, ...}], count}`. Probado real contra el álbum de
  Maximum Revolcadores: **2665 fotos**, paginado de 100 en 100. También
  existe `filters[recognitionImageUrl]` (búsqueda por selfie) y
  `filters[tagValue]` (búsqueda por dorsal) como query params del mismo
  endpoint — no se confirmó que este segundo filtro devuelva resultados
  reales (probado con un dorsal visible en una foto, 0 resultados; puede
  requerir que Lumepic ya haya procesado el OCR de esa foto).
- **Por qué de todos modos NO es viable para nuestro pipeline**: la
  `url`/`thumbnailUrl` del JSON son la fotografía real completa
  (confirmado descargándola: mismas dimensiones que el archivo pagado,
  ~115KB) pero con **marca de agua "LUMEPIC" grande superpuesta** más un
  texto pidiendo no redistribuir la foto — es la preview de venta, no el
  archivo entregable (que cuesta 6€ por foto en este álbum y solo se
  obtiene tras pagar, vía `/photographs/free-bulk-download-urls` u otro
  endpoint de compra). Aunque el endpoint es público y sin auth, no
  sirve como fuente para nuestro pipeline de cara/dorsal: la marca de
  agua no impediría técnicamente el matching (InsightFace/EasyOCR
  seguirían detectando cara/dorsal bajo ella), pero **redistribuir
  gratis lo que Lumepic vende de pago** no es aceptable — sí sería
  correcto mostrar el link-out a la propia página de Lumepic para que el
  usuario compre su foto directamente, igual que con las plataformas de
  §3.2.
- **Volumen real en el catálogo**: solo **1 carrera** (Maximum
  Revolcadores) de las 10 galerías vistas coincide con el catálogo de
  mi-dorsal, y su web oficial (`maximumrevolcadores.com`) ni siquiera
  enlaza a esa galería hoy.
- **Veredicto:** ❌ **Descartado como fuente para el pipeline** — no por
  falta de acceso técnico (el endpoint es público), sino porque las
  fotos son de pago y llevan marca de agua: redistribuirlas gratis en
  nuestros resultados sería incorrecto de cara al fotógrafo/Lumepic,
  aunque técnicamente estuviera al alcance. 🟢 **Lumepic** queda anotado
  como candidato de partnership comercial (¿API oficial para
  integradores, aparte del endpoint de la propia web?) si en el futuro
  se explora esa vía — mismo tratamiento que SportPXL/BuscoDorsal.

#### FindUpix (Canarias)
- **Web:** `https://findupix.com/`
- "Pack sport" con todas las fotos identificadas por dorsal, IA + fotógrafos.
- Integrado en Reventón Trail El Paso y otros eventos canarios.
- **Veredicto:** 🟢 **Contacto comercial**.

#### Sport-Visual (Salamanca + CyL)
- **Web:** `https://www.sport-visual.com/`
- Catálogo de eventos con búsqueda facial + dorsal (~20 carreras de CyL).
- **Veredicto:** 🟢 **Contacto comercial**.

#### Persígueme (Valladolid)
- **Web:** `https://persigueme.es/galerias-de-fotos/`
- Búsqueda por dorsal; 1ra descarga a 1 €, packs en HD sin marca de agua.
- ~100.000 participantes capturados en +10 años.
- Email: `info@persigueme.es`.
- **Veredicto:** 🟢 **Contacto comercial**.

#### Foto Sport Eventos (RFEG + FMG)
- **Web:** `https://www.fotosporteventos.com/`
- Proveedor oficial de las federaciones de gimnasia. Solo vende packs
  sueltos en eventos puntuales; el grueso se vende vía contratación.
- **Veredicto:** 🟢 **Contacto comercial**. Nicho: gimnasia.

#### Rhino Photo Sport (Madrid)
- **Web:** `https://rhinophotosport.es/`
- Oficial con sistema PICA + IA. Acreditado en Madrid.
- **Veredicto:** 🟢 **Contacto comercial**.

#### Cano Foto Sports (multi-CCAA)
- **Web:** `https://www.canofotosports.com/es/eventos`
- ~15 carreras/año (Triatlón Madrid, Garmin Epic Trail, Sea Otter, SCOTT
  Marathon BTT Girona, Ponle Freno Vigo, Alp Cerdanya…).
- **Veredicto:** 🟢 **Contacto comercial**.

#### Top Time "Time Photo" (dorsales + foto)
- **Web:** `https://www.toptime.es/servicios/`
- Mismo grupo que fabrica dorsales.
- **Veredicto:** 🟢 **Contacto comercial**.

#### Otros relevantes (mención rápida)
- **Fotocorredor:** `https://www.fotocorredor.com/`
- **FotosCarreras.com:** `https://www.fotoscarreras.com/`
- **Run Online / TuFotoCorriendo:** `https://www.tufotocorriendo.com/`
- **Jordi De La Fuente:** `https://www.jordidelafuente.com/fotografia-deportiva/`

---

### 3.3. Plataformas internacionales (referencia, no prioridad ahora)

- **Fotop** (Brasil/LatAm, multisede): `https://fotop.com/`
- **Replayfotos** (sub-marca Fotop): `https://replayfotos.fotop.com/?lang=es`
- **PhotoRunning** (Francia): `https://www.photorunning.com/`
- **Visual Profoto Sport** (España, portfolio B2B): `https://visualprofotosport.com/portfolio/`

Si en el futuro mi-dorsal se internacionaliza (Cataluña francesa, etc.),
estos son los candidatos naturales tras SportPXL.

---

### 3.4. Federaciones y prensa (links salidos en investigación, no fuente primaria)

- **Runedia (Mundo Deportivo):** `https://runedia.mundodeportivo.com/`
  indexa carreras, **no tiene fotos propias** — solo enlaza a medios.
  Veredicto: descartado como fuente, útil como backlink SEO.

- **SoyCorredor.es:** galería periodística, no buscar-por-dorsal. Útil como
  embudo de marketing, no como fuente: `https://www.soycorredor.es/...`

- **Flickr / Photodeportes / J.M.M.E. / DorsalCHIP:** freelancers
  individuales, **fuente real** vía cuenta de Flickr pública cuando se
  enlaza desde la web del organizador (caso Subida Pico Veleta). URL
  universal: `https://www.flickr.com/photos/{user}/albums/{photoset-id}`.

---

## 4. Cómo encajan en la arquitectura existente

El worker Python en `photo-search-api/` usa `findmyrace/sources/` con un
patrón `PhotoSource` + `get_source_for_url()`. **Para añadir un adapter nuevo**:

1. **Crear** `findmyrace/sources/{nombre}.py` con una clase que herede de
   `PhotoSource` y devuelva `(path_en_tmpdir, source_url_publica)`.
2. **Registrarla** en `findmyrace/sources/factory.py::get_source_for_url()`
   con el patrón de URL (regex) que la detecta.
3. **Conectar con la UI**: en `convex/photoSearch.ts::create`, ampliar el
   branch que detecta `flickr_url` para aceptar también los nuevos `kind`.
4. **Validar con una carrera real** antes de pasar a producción.

El `photo-search-api/api/find_photos.py` ya tiene el patrón de "descarga
paralela con backoff compartido" (`AdaptiveRateLimiter`, ver
`findmyrace/sources/base.py`) — reutilizable sin cambios para cada nuevo
source. También reutilizable sin cambios: la caché persistente de álbumes
(`api/album_cache.py`, 15 sep 2026) — cualquier `PhotoSource` nueva que
implemente `cache_key_for_url()` entra automáticamente en la misma caché
que ya usa Flickr, sin código adicional en `find_photos.py`.

---

## 5. Riesgos transversales (RGPD + Scraping)

| Riesgo | Mitigación | Doc de referencia |
|---|---|---|
| Scraping agresivo de una plataforma comercial | Solo link-out. Contacto comercial primero. | — |
| Embeddings faciales del propio usuario | Doble opt-in RGPD, 24h retention. Tabla `photoSearchJobs` con `consentGivenAt`, `consentVersion`, `consentIpHash` (SHA-256). | `docs/plans/PHOTO_SEARCH_OPS.md` §1.3, §1.4 |
| Re-DPIA interna antes de activar | Documento en `docs/legal/DPIA-photo-search.md` (pendiente crear en Sprint 0). | `docs/plans/PHOTO_SEARCH_OPS.md` §1.5 |
| Cesión de fotos scrapeadas sin permiso del fotógrafo | **Evitar**: el pipeline actual devuelve URL original, no copia. Respetar el `externalPhotos: true` de Sportmaniacs. | `docs/plans/PHOTO_SEARCH_TECH.md` §1 (sin copia de resultados) |

---

## 6. Lo que sigue sin hacerse y por qué

- **No se ha scrapeado ninguna plataforma cerrada** (§3.2). Razones
  legales, operativas y de calidad del match (sus fotos tienen marca de
  agua que rompe el OCR) — esto no cambia con la decisión de §7: seguimos
  tratándolas como **link-out / contacto comercial**, nunca scraping.
- **No se han creado adapters de FOTOS nuevos** (`findmyrace/sources/*.py`)
  para Sportmaniacs, ChipLevante, MasAtletismo, etc. — Sprint 0+1 (Convex
  wiring + Flickr en producción, ver §0) ya está terminado y validado con
  tráfico real, así que el prerequisito que bloqueaba esto ya no aplica.
  **Este es exactamente el trabajo que cubre §7.**
- **No se ha contactado comercialmente** con SportPXL, FindUpix,
  BuscoDorsal, etc. Sigue siendo una decisión de negocio, no de código.

---

## 7. Plan concreto para maximizar proveedores soportados

Decisión (15 sep 2026): **adoptar el máximo número de repositorios de
fotos posible**, no limitarse a Flickr. Con el dato real de §0 (solo 1
carrera de 2652 con `photosUrl`), hay DOS palancas distintas y hay que
tirar de ambas, no solo de una:

- **Palanca A — más proveedores soportados** (este plan, abajo): sin
  esto, aunque se enlacen álbumes, solo los de Flickr/ChipLevante son
  buscables.
- **Palanca B — enlazar álbumes existentes** (fuera del scope de este
  doc, es trabajo de catalogación/scraping de URLs, no de nuevos
  adapters): sin esto, tener más proveedores soportados no ayuda si
  ninguna carrera tiene su álbum enlazado. La excepción real resultó ser
  ChipLevante (vía su URL de resultados ya conocida, ver §7.3), no
  Sportmaniacs como se pensaba inicialmente — ver §3.1 para por qué.

### 7.1. Orden de implementación (por ratio impacto/esfuerzo) — actualizado tras verificar con datos reales

| # | Proveedor | Cobertura potencial | Esfuerzo | Estado |
|---|---|---|---|---|
| ~~1~~ | ~~Sportmaniacs~~ | ~~2162 carreras (81.5%)~~ | ~~~4-8h~~ | ❌ **Descartado** — verificado con 71 carreras reales, 0% tenían fotos activadas (ver §3.1). La promesa de "cobertura automática masiva" no se sostiene en la práctica. |
| ~~2~~ | ~~ChipLevante~~ | ~~113 carreras (4.3%)~~ | ~~~1 día~~ | ✅ **Hecho** (15 sep 2026) — con atajo por dorsal, no solo álbum general. Ver §3.1. |
| ~~—~~ | ~~Grupo Brotons~~ | ~~5-6 en `officialUrl`, 47 álbumes reales~~ | ~~~horas~~ | ✅ **Hecho** (15 sep 2026) — HTML estático sin JS, más simple que ChipLevante. Ver §3.1. Hallazgo colateral: `brotli` como dependencia nueva (ver §3.1). |
| 1 | **Flickr — más álbumes enlazados** (Palanca B) | Todo lo demás, pero requiere catalogación | 0 código | Sigue siendo el mayor ROI restante — máxima cobertura posible sin escribir una línea de adapter nuevo. Ver §7.4. Candidato concreto nuevo: `deportes.dipualba.es` ya enlaza a un perfil de Flickr real con 24+ álbumes (ver §3.1.2) — falta solo catalogar qué álbum va con qué carrera. |
| 2 | **UI: autocompletar álbum de ChipLevante/Grupo Brotons desde la carrera** | Las 113 de ChipLevante + las de Grupo Brotons, sin que el usuario pegue URL | ~horas-1 día | Los adapters ya existen; falta que `photoSearch.create` ofrezca la URL automáticamente cuando `race.scraperAdapter`/`officialUrl` ya apunte a uno de ellos. **Sigue pendiente**, ver §7.3. |
| — | **Candidatos sin veredicto firme**: atletaspopulares.es, carreraspopularesalmeria.com | 12 + 8 | ~horas de investigación | ⚠️ Bloqueos de red / posible contenido cargado por JS en la investigación con fetch simple (ver §3.1.2) — repetir con navegador real antes de descartar o implementar. |
| ~~3~~ | ~~Masatletismo / FDMValencia / A Coruña~~ | ~~Bajo (regional)~~ | ~~~1-2 días cada uno~~ | ❌ **Los tres descartados** (15 sep 2026, ver §3.1): Masatletismo cubre Andalucía/Córdoba (no CyL como se pensaba) con solo 6 carreras candidatas reales en el catálogo; FDMValencia enlaza a Facebook, no tiene galería propia; A Coruña solo tiene 2 carreras en el catálogo. |
| ~~—~~ | ~~"correbirras" / "carreraspopulares"~~ | ~~231 + 117 carreras~~ | — | ❌ **Descartados por estructura** — son agregadores de calendario (cada carrera vive en su propio dominio distinto: `lineadesalida.net`, `ayto.mutxamel.org`, etc.), no proveedores de fotos con patrón común. Un solo adapter no puede cubrir decenas de dominios sin estructura compartida. |
| ~~—~~ | ~~Facebook / Google Photos~~ | ~~21 carreras a Facebook, 0 a Google Photos~~ | — | ❌ **Descartados como búsqueda automática** (ver §3.1.3): Facebook prohíbe scraping en ToS; Google Photos exige OAuth del propietario y su HTML no trae el álbum completo. ✅ **Implementado como link-out** (15 sep 2026, `lib/photo-source-support.ts`) — botón "Abrir álbum" en vez de búsqueda por selfie. |
| — | **Google Drive** | **0 carreras hoy** — pero técnicamente viable | ~1 día si aparece demanda | ⏸️ **No descartado, aplazado.** Confirmado con prueba real (cuenta de servicio, sin OAuth del propietario, SÍ lee una carpeta "cualquiera con el enlace") — a diferencia de Facebook/Google Photos, aquí el bloqueo es solo de volumen, no técnico ni legal. Hoy tratado como link-out por pragmatismo (0 casos reales); ver §3.1.3. |
| 4 | **SportPXL partner** | Alto potencial, pero requiere acuerdo comercial + fee | ~1 semana + negociación | Decisión de negocio (Manu), no bloqueante |
| — | **Resto de plataformas cerradas (§3.2)** | — | — | Nunca scraping — solo link-out o contacto comercial |

**Lección del proceso Sportmaniacs→ChipLevante→Grupo Brotons→resto:** la
API/HTML/descripción de un proveedor puede prometer algo (campo
`has_photos`, columna "FOTODIPLOMA", "galería de fotos de la
federación") sin que se sostenga con datos reales — verificar contra
**decenas de carreras reales del catálogo de mi-dorsal**, no una o dos ni
la descripción de la web del proveedor, antes de invertir tiempo en un
adapter. ChipLevante y Grupo Brotons pasaron ese filtro; Sportmaniacs,
Masatletismo, FDMValencia, A Coruña, correbirras/carreraspopulares,
alcanzatumeta.es, babelsport.com, lineadesalida.net, dorsal21.com y
correpormurcia.com no (ver §3.1.2 y §3.1 para el detalle de cada uno).
**La lista original de proveedores candidatos con volumen alto está
agotada** — quedan dos candidatos sin veredicto firme por limitaciones
de la investigación (no por indicios negativos, ver fila de arriba), y
el trabajo de mayor ROI confirmado es la Palanca B (catalogar más
álbumes de Flickr/ChipLevante/Grupo Brotons, §7.4) y el pendiente de UX
de §7.3.

### 7.3. Pendiente: autocompletar el álbum de ChipLevante/Grupo Brotons desde la carrera

Los adapters (`ChipLevantePhotoSource`, `GrupoBrotonsPhotoSource`) ya
están en producción, pero hoy el usuario tiene que **pegar la URL del
álbum a mano** en el formulario (igual que con Flickr) — no se
implementó el autocompletado desde `raceId`. Para ChipLevante, que SÍ
tiene adapter de resultados en producción con la URL de cada carrera ya
conocida (`race.officialUrl`/`extractedFromUrl`, ver
`convex/scraper.ts::parseChiplevanteUrl`), esto sería:

1. En `convex/photoSearch.ts::create`, si `race.scraperAdapter ===
   "chiplevante"` y no se pasó `albumUrls`, usar `race.officialUrl` como
   álbum por defecto (mismo patrón que ya existe para `race.photosUrl`
   con Flickr).
2. UI: mostrar al usuario que "esta carrera tiene fotos de ChipLevante
   disponibles automáticamente" en vez de pedirle pegar un enlace.
3. Test contra una carrera real de ChipLevante que el usuario haya
   corrido (o simulando `myRaces` con dorsal conocido) antes de producción.

**Para Grupo Brotons es más difícil**: la ficha del evento no enlaza a su
álbum concreto (confirmado en §3.1 — solo al índice general), y
`race.officialUrl` apunta a la ficha del evento, no al álbum, así que no
hay una URL ya conocida que reutilizar automáticamente. Necesitaría
catalogación manual real (relacionar el nombre de la carrera con el
slug del álbum correspondiente en `grupobrotons.com/fotografias/`) —
Palanca B, no un simple cambio de código como en ChipLevante.

Esto (al menos la parte de ChipLevante) es más barato y de mayor ROI
inmediato que investigar un proveedor nuevo, porque el adapter ya
funciona — solo falta la UX para no depender de que el usuario copie
una URL.

### 7.4. Palanca B, aparte de este doc

Enlazar más álbumes de Flickr existentes (`races.photosUrl`) es trabajo
de catalogación, no de código de adapters — encajaría en un script de
enriquecimiento (mismo patrón que `scripts/enrich-photo-sources.ts`
propuesto en `face-search-architecture.md` §8, Oleada A), o en pedir a
organizadores qué fotógrafo usan (mismo punto que ya apuntaba una versión
anterior de este doc). No es prerequisito de 7.1 — son palancas
independientes y ambas suman.

### 7.5. Partner SportPXL (decisión de negocio, no bloqueante)

Contactar `contact@sportpxl.com` (`https://sportpxl.com/es/home/`) para
conocer coste de API real, módulos disponibles en el plan que ajustaría a
mi-dorsal, y SLA — en paralelo a 7.1-7.3, sin que uno bloquee al otro.

---

## 8. Referencias cruzadas

- `docs/plans/PHOTO_SEARCH_TECH.md` §13-§15 (fuentes actuales, decisiones de
  arquitectura, rate-limit Flickr)
- `docs/plans/PHOTO_SEARCH_PRD.md` §1, §10 (diferenciador real, huecos
  producto)
- `docs/plans/PHOTO_SEARCH_OPS.md` §1 (RGPD), §2 (costes)
- `docs/plans/SOURCES_RESEARCH.md` (fuentes de **resultados por dorsal**,
  complementario — no confundir con fuentes de **fotos** que es este doc)
- `photo-search-api/findmyrace/sources/` (implementación actual)
- `docs/optional/face-search-architecture.md` (capa 2/3 con InsightFace)
