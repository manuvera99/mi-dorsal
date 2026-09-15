# Fuentes de fotos de carreras populares en España

> **Estado:** investigación de proveedores hecha sep 2026; **re-revisado
> 15 sep 2026** tras cerrar Sprint 0+1 completos (ver tabla abajo — a
> diferencia de una versión anterior de este doc, la feature YA está en
> producción, no es un plan pendiente).
> **Propósito:** inventario de proveedores que alojan galerías de fotos de
> carreras populares españolas, con URLs reales verificadas, para evaluar
> cuáles pueden integrarse en la feature "Encuentra tus fotos" descrita en
> `docs/plans/PHOTO_SEARCH_TECH.md` y `docs/plans/PHOTO_SEARCH_PRD.md`.
> **Sigue sin implementarse ningún adapter de FOTOS nuevo.** Solo el de
> Flickr (`photo-search-api/findmyrace/sources/flickr.py`) descarga fotos
> reales hoy — el resto de proveedores de esta lista son candidatos
> investigados, no código. (Sportmaniacs y ChipLevante SÍ tienen adapter
> en producción, pero para **resultados por dorsal**, un sistema
> completamente distinto — no reutilizable para fotos sin escribir código
> nuevo.)

---

## 0. Estado real de la feature (actualizado 15 sep 2026)

| Pieza | Estado |
|---|---|
| Pipeline InsightFace+EasyOCR+Matcher | ✅ Producción |
| Endpoint FastAPI en Modal (`manuvera08--photo-search-api-fastapi-app.modal.run`) | ✅ Producción |
| Descarga con backoff adaptativo compartido entre álbumes (`AdaptiveRateLimiter`) | ✅ Producción |
| Source adapter Flickr (único proveedor de FOTOS) | ✅ Producción |
| Caché persistente de álbumes entre búsquedas (Modal Volume) | ✅ Producción (15 sep 2026) |
| Alerta si Flickr rompe la extracción del `site_key` público | ✅ Producción (15 sep 2026) |
| Schema Convex `photoSearchJobs` | ✅ Producción |
| UI Next.js (`/perfil/fotos`, selector de álbumes de perfil, hasta 3 álbumes) | ✅ Producción |
| Convex mutations + scheduled actions | ✅ Producción |
| Email "photos_found" | ✅ Producción |
| Gate Pro + límite de fotos por job (`MAX_PHOTOS_PER_JOB=1500`) | ✅ Producción |
| API key propia de Flickr (vs. `site_key` público reutilizado) | ⏸️ Aplazado — exige cuenta Flickr Pro (82€/año), se revisita cuando la feature facture |
| Source adapters para Sportmaniacs/ChipLevante/etc. (este doc) | ❌ No implementado |

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

#### Sportmaniacs (Localbi/Evide)
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
- **Galería de ejemplo:**
  `https://sportmaniacs.com/en/races/rankings/67fac772-ba88-4768-9f80-4174ac1f1368`
  → ver atributos `photos.sm` y `externalPhotos` por participante.
- **Ventaja real confirmada (15 sep 2026):** `races.sportmaniacsEventIds`
  (ver `convex/schema.ts`) ya está poblado para las 2162 carreras con
  `scraperAdapter === "sportmaniacs"` — el UUID de evento real (el que
  acepta el endpoint de ranking) ya está cacheado desde el backfill de
  resultados. Un adapter de fotos NO necesitaría volver a resolver ese
  UUID desde el HTML, solo llamar directamente al ranking con el UUID ya
  guardado — reduce aún más el coste estimado abajo.
- **Veredicto:** ⚙️ **Adaptable** como `SportmaniacsPhotoSource`. La URL
  pública de cada foto ya viene dada por el JSON de ranking — no hay nada
  que descargar ni OCR. Coste de desarrollo: ~4-8 horas.

#### ChipLevante (Levante: Alicante, Murcia, Albacete, Cuenca, Castellón)
- **HTML scrapeable** en la ficha de cada carrera:
  `https://www.chiplevante.com/es/prueba/{slug}`
  columna `FOTODIPLOMA` con enlace por dorsal.
- **Histórico legacy:**
  `http://www.chiplevante.net/{YEAR}{NOMBRECARRERA}/clasificaciones.asp`
- **Estado actual del adapter:** `scraperAdapter: "chiplevante"` para
  **resultados por dorsal** ya en producción
  (`docs/plans/SOURCES_RESEARCH.md` §2, 114 carreras).
  **No hay adapter de fotos todavía.**
- **Veredicto:** ⚙️ **Adaptable** como `ChipLevantePhotoSource`. Spider HTML
  simple (~100 líneas), reutiliza el `PhotoSource.download()` con backoff.
  Coste: ~1 día.

#### Masatletismo (Federación Atletismo Castilla y León + nacionales)
- **Media library WordPress estándar**:
  `https://masatletismo.com/wp-content/uploads/YYYY/MM/*.jpg`
- **Sitemap XML** listado en `docs/plans/SOURCES_RESEARCH.md` §5.
- **Galería ejemplo:**
  `https://masatletismo.com/2026/08/08/mas-de-5-000-fotos-en-la-galeria-fotografica-de-la-recogidas-de-dorsales-y-carrera-de-la-42-edicion-de-la-subida-al-pico-veleta/`
- **Veredicto:** ⚙️ **Adaptable** como `MasAtletismoSource`. Gallery page
  HTML con texto plano + media library scrapable. Coste: ~1-2 días.

#### FDM Valencia (Federación)
- **Galería del circuito oficial**:
  `https://carreras.fdmvalencia.es/es/fotos-carreras-populares-valencia/`
- **Veredicto:** ⚙️ **Adaptable**. HTML estático con grid de fotos por
  carrera/edición. Coste: ~1 día.

#### A Coruña (Ayuntamiento)
- **Galería federaciones locales**:
  `https://www.coruna.gal/carreraspopulares/es/galerias-de-fotos?argIdioma=es`
- **Veredicto:** ⚙️ **Adaptable**. Mismo patrón.

#### Subida Internacional Granada – Pico Veleta
- **Sección GALERÍA** en `subidaveleta.com` con colaboradores externos
  (Photodeportes, J.M.M.E., Pedro Montesinos, Pitufollow, DorsalCHIP).
- Cada enlace apunta a un álbum Flickr de un fotógrafo particular — útil
  como punto de partida, no como fuente propia.
- **Veredicto:** ⚙️ **Adaptable parcialmente**. Solo si los colaboradores son
  Flickr público; si no, son links externos a webs con sus propias políticas.

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
  esto, aunque se enlacen álbumes, solo los de Flickr son buscables.
- **Palanca B — enlazar álbumes existentes** (fuera del scope de este
  doc, es trabajo de catalogación/scraping de URLs, no de nuevos
  adapters): sin esto, tener 5 proveedores soportados no ayuda si ninguna
  carrera tiene su álbum enlazado. Sportmaniacs es la excepción — ver
  más abajo, no depende de que nadie "enlace" nada.

### 7.1. Orden de implementación (por ratio impacto/esfuerzo)

| # | Proveedor | Cobertura potencial | Esfuerzo | Por qué este orden |
|---|---|---|---|---|
| 1 | **Sportmaniacs** | 2162 carreras (81.5% del catálogo) — **automático**, no depende de que nadie enlace nada (`sportmaniacsEventIds` ya poblado) | ~4-8h | Mayor cobertura posible por lejos, y la única fuente que no depende de la Palanca B — se activa sola en las 2162 carreras el día que se despliega |
| 2 | **ChipLevante** | 113 carreras (4.3%), adapter de resultados ya en producción (mismo dominio, mismo patrón de URL por carrera) | ~1 día | Segunda mayor cobertura automática — mismo argumento que Sportmaniacs, ya sabemos qué carreras son (`scraperAdapter === "chiplevante"`) |
| 3 | **Flickr — más álbumes enlazados** | Todo lo demás, pero requiere Palanca B | 0 (ya soportado) | No es un adapter nuevo — es simplemente pedirle al equipo de contenido/scraping que rellene `photosUrl` en más carreras. Máximo ROI con cero código. |
| 4 | **Masatletismo / FDMValencia / A Coruña** | Bajo (regional, sin ID cacheado — requiere Palanca B) | ~1-2 días cada uno | Solo rentable si se confirma que alguna de estas regiones tiene demanda real (CyL, Valencia, Galicia) |
| 5 | **SportPXL partner** | Alto potencial, pero requiere acuerdo comercial + fee | ~1 semana + negociación | Decisión de negocio (Manu), no bloqueante para 1-4 |
| — | **Resto de plataformas cerradas (§3.2)** | — | — | Nunca scraping — solo link-out o contacto comercial, sin cambios respecto a antes |

### 7.2. Por qué Sportmaniacs primero (y con diferencia)

A diferencia de todo lo demás en esta tabla, Sportmaniacs **no necesita
que nadie enlace un álbum a mano**: `races.sportmaniacsEventIds` ya tiene
el UUID real de evento cacheado para las 2162 carreras con
`scraperAdapter === "sportmaniacs"` (ver §3.1). Un
`SportmaniacsPhotoSource` que reciba ese UUID y llame al JSON de ranking
público (`photos.sm` por participante) queda automáticamente disponible
para el 81.5% del catálogo el día que se despliega — sin trabajo de
catalogación previo, sin depender de que el fotógrafo/organizador haga
nada. Es la única fuente de esta lista con ese efecto de "un solo
despliegue, cobertura masiva instantánea".

### 7.3. Cómo implementar Sportmaniacs y ChipLevante (pasos 1-2)

Reutilizando exactamente el patrón de §4 (`PhotoSource` +
`get_source_for_url()`) y la infraestructura ya construida (caché de
álbumes, rate limiter compartido, `max_images`/timeout):

1. `findmyrace/sources/sportmaniacs.py` — `SportmaniacsPhotoSource`:
   - `can_handle()`: URL de ranking (`sportmaniacs.com/.../races/rankings/{uuid}`)
     o, mejor, aceptar directamente el UUID desde `races.sportmaniacsEventIds`
     sin depender de que el usuario pegue una URL (a decidir en la UI —
     ver punto 4).
   - `list_photo_urls()`: GET al JSON de ranking (header
     `X-Requested-With: XMLHttpRequest`), extrae `photos.sm` de cada
     participante, deduplicado.
   - `cache_key_for_url()`: el UUID del evento — mismo patrón que
     `FlickrSource.cache_key_for_url()`, entra gratis en la caché de
     álbumes de `api/album_cache.py`.
   - Respetar `externalPhotos: true` (ver Riesgos, tabla de §5) —
     excluir esas fotos si el flag indica que Sportmaniacs no tiene
     derecho a redistribuirlas directamente.
2. `findmyrace/sources/chiplevante.py` — spider HTML de la columna
   `FOTODIPLOMA` en `chiplevante.com/es/prueba/{slug}`.
3. Registrar ambos en `findmyrace/sources/factory.py::get_source_for_url()`.
4. **UI/Convex**: en vez de depender solo de que el usuario pegue una URL
   de álbum (como hoy con Flickr), para Sportmaniacs/ChipLevante se puede
   **autocompletar el álbum de la propia carrera** — `photoSearch.create`
   ya conoce `raceId`, y `races.scraperAdapter`+`sportmaniacsEventIds` ya
   identifican si esa carrera es candidata, sin que el usuario tenga que
   pegar ningún enlace. Esto es lo que realmente destraba la cobertura
   masiva de §7.2 — un cambio de UI, no solo de backend.
5. Test contra una carrera real de cada proveedor antes de producción
   (mismo patrón que se usó para validar Flickr con mikemanitasdpm).
6. Deploy a Modal + Convex, mismo checklist que el resto de esta sesión
   (tests, tsc --noEmit, build, deploy).

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
