# Arquitectura de búsqueda facial en mi-dorsal

> **Estado:** la búsqueda facial de Capa 3 (más abajo) **ya está en
> producción** — el estado de partida de este doc (una propuesta inicial
> de sep 2026 que asumía Sprint 0/1 sin cerrar) quedó obsoleto tras el
> trabajo real hecho la semana del 14-15 sep 2026, ver §1 actualizado.
> **Propósito, sin cambios:** documentar la arquitectura de búsqueda
> facial de "Encuentra tus fotos", respetando RGPD España, y — la parte
> que sí sigue siendo un plan y no código — evaluar Capa 1 (más
> proveedores de fotos, ver `docs/optional/photo-sources.md`) como
> siguiente ampliación.
> **Lo pendiente real hoy no es Capa 3 (búsqueda facial), es Capa 1**
> (más proveedores de fotos) — ver §11, actualizado con el plan concreto
> de `photo-sources.md` §7.

---

## 1. Estado de partida (actualizado 15 sep 2026)

Lo que ya existe en producción — a diferencia de la versión anterior de
este doc, **la búsqueda facial YA es la que corre en cada búsqueda real**,
no un plan de Capa 3 futuro:

| Pieza | Localización | Estado |
|---|---|---|
| Pipeline InsightFace+EasyOCR+Matcher | `photo-search-api/findmyrace/` (copia de `find-my-race/src/findmyrace/`) | ✅ Producción |
| Endpoint FastAPI servido en Modal | `photo-search-api/modal_app.py` + `api/find_photos.py` | ✅ Producción (`manuvera08--photo-search-api-fastapi-app.modal.run`, timeout 1500s) |
| Descarga con backoff adaptativo compartido entre álbumes de la misma búsqueda | `findmyrace/sources/base.py::AdaptiveRateLimiter` (pública desde 15 sep 2026) | ✅ Producción |
| Caché persistente de álbumes entre búsquedas distintas | `photo-search-api/api/album_cache.py` + Modal Volume `photo-search-album-cache` | ✅ Producción (15 sep 2026) |
| Source adapter Flickr (único proveedor de fotos completo) | `findmyrace/sources/flickr.py` | ✅ Producción |
| Schema Convex `photoSearchJobs` (selfies, resultados, stats) | `convex/schema.ts` | ✅ Producción |
| UI Next.js (`/perfil/fotos`, `/perfil/fotos/[raceId]`, selector de álbumes de perfil hasta 3) | `components/perfil/photo-search-*.tsx` | ✅ Producción |
| Convex mutations + scheduled actions (`photoSearch.ts`, `photoSearchActions.ts`) | `convex/` | ✅ Producción |
| Conexión Modal ↔ Convex con secret compartido | `PHOTO_SEARCH_API_SECRET`/`PHOTO_SEARCH_API_URL` (`npx convex env`) | ✅ Producción |
| Email "photos_found" | `convex/emails/templates/photosFound.ts` | ✅ Producción |
| Límite de fotos por job + aviso de fotos omitidas en UI | `MAX_PHOTOS_PER_JOB=1500`, `stats.photosOmitted` | ✅ Producción (15 sep 2026) |
| Alerta si Flickr rompe la extracción del `site_key` público | `convex/crons/checkFlickrSiteKeyHealth.ts` | ✅ Producción (15 sep 2026) |

Lo que **NO** existe y sigue siendo plan, no código:

- **Source adapters adicionales** a Flickr (Sportmaniacs, ChipLevante,
  etc. — ver `docs/optional/photo-sources.md` §7, plan concreto con
  orden de prioridad por impacto/esfuerzo).
- **API key propia de Flickr** (hoy se reutiliza el `site_key` público
  del frontend de flickr.com — funciona, pero pedir una propia exige
  cuenta Flickr Pro de pago, aplazado hasta que la feature facture).
- Las tablas RGPD de Capa 3 tal como las describía §3.3 más abajo
  (`faceSearchConsent`, `userFaceEmbeddings`, `facePhotoEmbeddings`) — la
  implementación REAL no necesitó esas tablas: no hay indexado
  persistente de embeddings entre búsquedas, cada job calcula el
  embedding de la selfie en memoria y lo descarta al terminar (ver
  §2 más abajo, la arquitectura por capas real terminó siendo más simple
  que la propuesta original).

---

## 2. Arquitectura por capas

```
┌─────────────────────────────────────────────────────────┐
│ Capa 3 · Búsqueda facial (opt-in RGPD)                  │
│   • User sube 1 selfie desde /perfil/mis-fotos        │
│   • Doble opt-in (newsletter-style)                     │
│   • Modal genera embedding 512-D con buffalo_l         │
│   • Convex vector index busca top-K contra embeddings   │
│     de fotos indexadas en carreras del historial        │
│   • Retención 24h · revocación 1-click                 │
└─────────────────────────────────────────────────────────┘
                             ▲
┌─────────────────────────────────────────────────────────┐
│ Capa 2 · Búsqueda por dorsal (default, gratis, RGPD-safe)│
│   • Tabla Convex (dorsal, raceId, photoUrl)              │
│   • Construida por cron semanal desde Sportmaniacs/      │
│     ChipLevante/etc.                                    │
└─────────────────────────────────────────────────────────┘
                             ▲
┌─────────────────────────────────────────────────────────┐
│ Capa 1 · Agregación de fuentes de fotos                 │
│   • Tabla Convex racePhotoSources                       │
│     (raceId, provider, kind, baseUrl)                   │
│   • kinds: sm_ranking_public · chiplevante_gallery ·    │
│     gallery_external · partner_official ·              │
│     masatletismo_wp                                     │
└─────────────────────────────────────────────────────────┘
```

**Por qué este orden:** permite lanzar la feature con solo Capa 2 (que es
lo que el plan `PHOTO_SEARCH_TECH.md` ya cubre con Flickr) y añadir
progresivamente Capa 1 (más fuentes) y Capa 3 (búsqueda facial) **sin
redepliegues disruptivos**. Cada capa es independiente.

---

## 3. Capa 1 — Catálogo de fuentes de fotos

### 3.1. Schema Convex propuesto

```ts
// Añadir a convex/schema.ts (en definir antes de Sprint 1):

racePhotoSources: defineTable({
  raceId: v.id("races"),
  provider: v.union(
    v.literal("sportmaniacs"),        // S3 ranking URL + fotos.sm por participante
    v.literal("chiplevante"),          // HTML fotodiploma
    v.literal("masatletismo"),         // WP media library
    v.literal("fdm_valencia"),         // HTML oficial
    v.literal("a_coruna"),            // HTML oficial
    v.literal("subida_veleta"),        // links externos a colaboradores (Flickr)
    v.literal("busco_dorsal"),         // partner externo (link)
    v.literal("findupix"),             // partner externo (link)
    v.literal("sport_visual"),         // partner externo (link)
    v.literal("persigueme"),           // partner externo (link)
    v.literal("sportpxl_partner"),     // B2B partner con API
    v.literal("flickr_direct"),        // URL Flickr explícita
    v.literal("other"),                // catch-all con baseUrl
  ),
  kind: v.union(
    v.literal("sm_ranking_public"),    // URL al ranking público Sportmaniacs
    v.literal("chiplevante_gallery"),  // URL al detalle de prueba ChipLevante
    v.literal("gallery_html"),         // HTML scrapeable con grid de fotos
    v.literal("s3_public"),            // URL a bucket S3 público (e.g. sm-fotos.sportmaniacs.com)
    v.literal("partner_official"),     // enlace a galería de partner comercial
    v.literal("external_link"),        // link externo sin scrape
  ),
  baseUrl: v.string(),                 // URL principal (perfil de carrera, ranking, etc.)
  albumId: v.optional(v.string()),     // ID específico en el proveedor (e.g. Flickr photoset_id, Sportmaniacs UUID)
  notes: v.optional(v.string()),
  discoveredAt: v.number(),
  discoveredBy: v.union(v.literal("script"), v.literal("admin"), v.literal("user_report")),
  lastVerifiedAt: v.optional(v.number()),
})
  .index("by_race", ["raceId"])
  .index("by_provider", ["provider"])
  .index("by_kind", ["kind"])
  .index("by_race_kind", ["raceId", "kind"]),
```

### 3.2. Capa 2 — Búsqueda por dorsal (sin OCR)

```ts
// Snapshots de URLs estables encontradas:

racePhotoEntries: defineTable({
  raceId: v.id("races"),
  sourceId: v.id("racePhotoSources"),
  dorsal: v.string(),                  // dorsal exacto de la foto
  photoUrl: v.string(),                // URL pública (puede ser CDN del proveedor)
  thumbnailUrl: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  external: v.boolean(),               // true si la descarga del alta resolución es de pago
  fetchedAt: v.number(),
  expiresAt: v.optional(v.number()),   // para purga de URLs caducadas (S3 temporales)
})
  .index("by_race", ["raceId"])
  .index("by_dorsal", ["dorsal"])
  .index("by_race_dorsal", ["raceId", "dorsal"])
  .index("by_source", ["sourceId"])
  .index("by_expires_at", ["expiresAt"]),
```

### 3.3. Capa 3 — Búsqueda facial (opt-in)

```ts
// Consentiiento del usuario (RGPD)

faceSearchConsent: defineTable({
  userId: v.id("profiles"),
  status: v.union(
    v.literal("pending"),       // pidió activar, esperando confirmar email
    v.literal("active"),        // confirmó, embeddings aceptados
    v.literal("revoked"),       // retiró consentimiento, embeddings borrados
    v.literal("expired"),       // >30d sin usar → limpieza automática
  ),
  confirmToken: v.optional(v.string()),      // one-shot
  consentGivenAt: v.optional(v.number()),
  consentVersion: v.string(),                // "v1.0-2026-09-XX"
  consentIpHash: v.optional(v.string()),     // SHA-256 con salt (env var)
  revokedAt: v.optional(v.number()),
  retentionDays: v.number(),                 // default 30
})
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_expires", ["retentionDays"]),

// Embeddings del usuario (uno por activación, NO por selfie)

userFaceEmbeddings: defineTable({
  userId: v.id("profiles"),
  embedderModel: v.string(),       // "buffalo_l_v1"
  vector512: v.array(v.number()),  // 512 floats L2-normalizados
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_model", ["userId", "embedderModel"]),

// Embeddings de fotos indexadas

facePhotoEmbeddings: defineTable({
  photoEntryId: v.id("racePhotoEntries"),
  embedderModel: v.string(),
  vector512: v.array(v.number()),
  detectedAt: v.number(),
})
  .index("by_photo_entry", ["photoEntryId"])
  .index("by_model", ["embedderModel"]),
```

---

## 4. RGPD España — el factor decisivo

Lo que dice la AEPD (sanciones 2024-2025):

- **Datos biométricos faciales son categoría especial** (Art. 9 RGPD).
- **Tratamiento 1:N prohibido** salvo excepciones taxativas.
- **AEPD PS/00289/2024**: 96.000 € a cadena de gimnasios.
- **Sanciones a Osasuna El Sadar y club de fútbol** (200.000 €): consentimiento
  válido pero no superó el juicio de necesidad/proporcionalidad.

**Lo que esto implica para mi-dorsal:**

| Decisión | Estado en RGPD |
|---|---|
| Ofrecer búsqueda por dorsal | ✅ Libre. La tabla dorsal→URL NO trata datos biométricos. |
| Ofrecer búsqueda facial | ✅ Solo con consentimiento explícito (Art. 9.2.a). EIPD obligatoria. Revocable. Embeddings cifrados. |
| Indexar embeddings faciales sin opt-in | ❌ Sanción segura. |
| Delegar en proveedor externo con DPA (SportPXL, Azure Face) | ⚠️ Posible, pero **tú eres responsable** (Art. 28). DPA + sede UE + garantías. |
| Descargar fotos de galerías externas y re-indexar localmente | ⚠️ LSSI + derecho a la imagen del fotógrafo. Autorización del organizador/fotógrafo. |

**Plantilla a copiar:** el doble opt-in RGPD del newsletter de mi-dorsal
(memorizado en `topics/mi-dorsal.md` §"Convex — Newsletter doble opt-in
(RGPD España)"). Mismo patrón: `confirmToken` one-shot + `unsubscribeToken`
estable + SHA-256 con salt para IP.

**⚠️ Hallazgo real (15 sep 2026, verificado en código — no en un plan):**
la feature YA está en producción procesando caras de selfies reales
(§1), pero:

- `app/legal/privacidad/page.tsx` **no menciona** "Encuentra tus fotos"
  ni el procesamiento facial en absoluto — confirmado leyendo el archivo
  completo, la única mención de "foto" es la foto de perfil de cuenta.
- `components/perfil/photo-search-upload-form.tsx` **no tiene ningún
  checkbox ni texto de consentimiento RGPD** antes de subir las selfies —
  confirmado leyendo el componente completo, el único checkbox que existe
  ahí es el selector de álbumes de Flickr, no un consentimiento.

Esto es una brecha real entre "lo que dice la ley" (tabla de arriba,
Art. 9.2.a exige consentimiento explícito para datos biométricos) y "lo
que hace el producto en producción hoy". No es un defecto de arquitectura
— el pipeline sí borra selfies y embeddings al terminar cada job (§1,
`cache_dir` vive en el `tmpdir` efímero) — es una falta de **superficie de
consentimiento explícita** de cara al usuario. Antes de escalar el
tráfico de esta feature (más proveedores de fotos = más búsquedas reales,
ver `photo-sources.md` §7), esto debería cerrarse.

**Pre-launch obligatorio (sigue pendiente, ahora con más urgencia por lo
anterior):**

- EIPD en `docs/legal/DPIA-photo-search.md` (PHOTO_SEARCH_OPS §1.5,
  pendiente crear).
- Actualizar `app/legal/privacidad/page.tsx` con la sección §1.2 de
  `PHOTO_SEARCH_OPS.md` — hoy no dice nada sobre esto, ver hallazgo arriba.
- Checkbox de consentimiento explícito antes de subir selfies, **no
  pre-marcado** (lección Yoti 2025, `PHOTO_SEARCH_OPS.md` §1.6) — hoy no
  existe ningún checkbox de este tipo en el formulario real.

---

## 5. Comparativa de costes por foto

| Opción | Coste por foto | Coste carrera 5.000 fotos | Calidad |
|---|---|---|---|
| **InsightFace self-hosted** (CPU) | $0 | $0 hardware propio / ~$5 GPU spot | 95-98% condiciones óptimas |
| InsightFace + pgvector self-hosted | $0 | $0 si ya tienes Postgres | 95-98% |
| **SportPXL Vision API** | 0,08 €/foto (transfer) | ~400 € | >94% |
| Azure Face API | ~$1.50/1000 | ~$7.50 | 95%+ |
| Google Cloud Vision (face det, sin 1:N) | $1.50/1000 | $7.50 | 90% |
| AWS Rekognition | $1.25/1000 | $6.25 | 95% |
| FaceCheck.ID / ProFaceFinder | $0.10/búsqueda | Variable | Variable |

**Lectura:** para el MVP, **self-hosted InsightFace en Fly.io / Modal
persistente** (lo que ya tienes) sale gratis hasta ~50k fotos/mes (CPU).
Ya tienes el código en `findmyrace/face.py` con cache de embeddings vía SHA-256.

---

## 6. Coste desglosado de Modal (corregido tras pruebas reales)

`docs/plans/PHOTO_SEARCH_OPS.md` §2.1 advertía:

> La tabla original solo cuenta el tiempo de matching, no el de **descargar
> el álbum**, que en la práctica tarda varios minutos con 500 fotos
> (Flickr aplica rate-limit real). Si esa descarga ocurre dentro de la misma
> función Modal con GPU activa, **se paga GPU ociosa** todo ese tiempo.
>
> **Mitigación recomendada:** separar la descarga (función Modal CPU-only)
> del matching (función GPU, solo con fotos ya en disco/volumen compartido).

**Nota (15 sep 2026):** este riesgo era hipotético — en producción real
se corre **sin GPU** (`cpu=2, memory=4096` en `modal_app.py`, ver §1), así
que no hay GPU ociosa que pagar durante la descarga. El refactor A/B
worker de abajo sigue sin implementarse y no hace falta hoy por ese
motivo — el problema real que sí apareció (timeout + rate-limit de
Flickr, ver `photo-sources.md` §0) se resolvió sin separar workers: subir
el timeout real, limitar fotos por job, y sobre todo el **Modal Volume
`photo-search-album-cache`** (ya en producción desde el 15 sep 2026, ver
`api/album_cache.py`) — mismo nombre que el volumen "propuesto" abajo,
pero un propósito distinto: no es el paso intermedio de un split
CPU/GPU, es una caché de álbumes reutilizada ENTRE búsquedas distintas
(evita re-descargar de Flickr cuando dos corredores buscan la misma
carrera). El split A/B de abajo sigue siendo un plan, no código:

**Refactor A/B propuesto (solo si algún día se activa GPU real):**

- Worker A (CPU-only, barato): descarga álbum → graba fotos en el mismo
  volumen `photo-search-album-cache` que ya existe hoy.
- Worker B (GPU, A10G): lee fotos del volumen compartido, ejecuta pipeline,
  devuelve resultados.
- Job Convex: orquesta A→B secuencialmente, con pre-signed URLs al
  volumen como estadio intermedio.

**Hoy** con un solo usuario Pro buscando a la vez, el coste medido por job
es ~$0.03-0.10. Es aceptable.

---

## 7. Flujo end-to-end real (verificado en código, no un plan)

```
[1] user click "Buscar mis fotos" en /perfil/fotos/[raceId]
    │
    ▼
[2] UI components/perfil/photo-search-upload-form.tsx:
    • 1-3 selfies (no hay mínimo de "frontal+lateral" forzado en código)
    • dorsal pre-rellenado desde myRaces
    • selector de álbumes de perfil de Flickr (hasta 3), o pegar URL a mano
    • (⚠️ sin checkbox RGPD — ver hallazgo en §4)
    • mutation Convex photoSearch.create
    │
    ▼
[3] Convex photoSearch.create (convex/photoSearch.ts):
    • check Pro gate (currentUserHasPremium) + límite MAX_JOBS_PER_DAY
    • valida albumUrls (al menos 1 de Flickr, máx 3)
    • crea photoSearchJobs {status: "pending"}
    • scheduler.runAfter(0, internal.photoSearchActions.runJob)
    │
    ▼
[4] Convex photoSearchActions.runJob (internalAction, "use node"):
    • markRunning
    • ctx.storage.getUrl() por cada selfie (URLs firmadas, no hardcodeado a 1h)
    • POST a Modal /api/find_photos con bearer PHOTO_SEARCH_API_SECRET
    • await response (síncrono, no polling — Modal responde cuando termina
      o hasta el timeout de 1500s)
    • markDone {results, stats} o markError {error}
    • if results.length >= 1: sendPhotosFoundEmail
    │
    ▼
[5] Modal fastapi_app (modal_app.py, api/find_photos.py):
    • descarga selfies (httpx)
    • FaceRecognizer.assess_reference() por selfie (rechaza calidad mala)
    • descarga cada álbum: FlickrSource, reutilizando fuente+rate limiter
      por tipo entre álbumes de la misma búsqueda; álbum servido desde el
      Modal Volume "photo-search-album-cache" si ya se descargó antes
      en OTRA búsqueda (ver album_cache.py)
    • pipeline.run(image_paths=..., target_dorsal, top_k, max_images=1500)
    • devuelve {jobId, status: "done"|"error", results[], stats}
    │
    ▼
[6] Convex photoSearch.getResults (useQuery reactivo, no polling manual):
    • components/perfil/photo-search-results.tsx muestra grid + scores
    • aviso si stats.photosOmitted > 0 (álbum más grande de lo que se pudo analizar)
    • cada foto enlaza a r.photoUrl (Flickr original, link-out — sin copia propia)
    │
    ▼
[7] Cleanup:
    • crons/cleanupPhotoSearch diario 03:15 UTC — borra jobs >24h
    • selfies de Convex Storage se borran en cuanto el job termina
      (markDone/markError/cancel), no esperan al cron de 24h
    • face_cache (embeddings de referencia) vive en el tmpdir efímero de
      Modal — se borra solo al salir del `with tempfile.TemporaryDirectory`,
      nunca persiste entre jobs
```

---

## 8. Plan de implementación — reconciliado con lo que realmente se construyó

Las "3 oleadas" de una versión anterior de este doc asumían una
arquitectura de **indexación previa** (tablas `racePhotoSources` +
`racePhotoEntries`, cron semanal que pre-calcula `dorsal → URL`, embeddings
faciales indexados de antemano por foto). **Esa NO es la arquitectura que
se construyó.** Lo que corre en producción hoy (§7) es un pipeline **en
vivo, por búsqueda**: cada job descarga el álbum (o lo lee de la caché de
`album_cache.py` si otra búsqueda ya lo trajo) y hace el matching cara+
dorsal+color en el momento — sin tabla de índice, sin cron de indexado,
sin embeddings persistidos.

**Esto cambia la recomendación real para "cuántos más proveedores
mejor" (decisión del 15 sep 2026):** extender el pipeline en vivo ya
probado con un `PhotoSource` nuevo por proveedor (ver
`docs/optional/photo-sources.md` §7, plan concreto con Sportmaniacs y
ChipLevante primero) es **más rápido y ya validado con tráfico real**
que construir desde cero la infraestructura de indexación de las Oleadas
A/B de abajo — no hace falta esa infraestructura para tener más
proveedores, Flickr ya demuestra que el patrón "adapter en vivo" escala
sin ella.

**Dicho esto, las Oleadas A/B originales siguen teniendo un caso de uso
real y distinto**, que no compite con lo anterior: una vista "tus fotos
de esta carrera" **sin selfie ni matching facial**, solo por dorsal
conocido — útil como fallback gratuito/RGPD-trivial para el corredor que
no quiere subir una selfie. Si se decide construir esto en el futuro,
mantener las tablas de abajo tal cual (no han cambiado):

### Oleada A — "Link-out" (1-2 semanas, 0 € coste infra) — sigue sin construirse

1. `convex/racePhotoSources.ts` (schema + `adminLinkPhotoSource`,
   `getSourcesByRace`).
2. `scripts/enrich-photo-sources.ts` que cruza las 2652 carreras del
   catálogo real (dato actualizado, ver `photo-sources.md` §0) con:
   - `slug` + dominio para detectar Sportmaniacs / ChipLevante.
   - URL en `photosUrl` si ya está en alguna carrera (re-extracción).
3. `components/race-detail/photo-sources.tsx` en la ficha de carrera con
   tres botones: "Buscar por dorsal en [proveedor]" / "Ver galería oficial"
   / "Subir selfie para buscarte" (⚠️ el copy de "RGPD" del original daba
   por hecho un checkbox que no existe hoy, ver hallazgo §4 — corregir
   antes de escribir este copy, no después).
4. **Copy** de los botones calibrado al gate RGPD real (una vez exista),
   sin enlaces rotos.

### Oleada B — "Dorsal → URL real" (2-3 semanas, 0-50 €/mes) — sigue sin construirse

1. Worker Vercel (cron semanal) que:
   - Recorre `racePhotoSources` con `kind = sm_ranking_public`.
   - Llama al JSON de ranking de Sportmaniacs → extrae `photos.sm` por
     participante → `racePhotoEntries`.
   - Idem para ChipLevante scrapeando su HTML.
2. Endpoint `/api/photos/by-dorsal?dorsal=X&raceId=Y` → devuelve thumbnails
   con `sourceProvider` + `external` flag.
3. UI en `/perfil/carreras/[id]` → botón "Ver mis fotos" por carrera
   jugada del usuario.
4. **Solo link-out**: no copia fotos a Convex Storage.

### Oleada C — YA CONSTRUIDA, pero con una arquitectura distinta a la propuesta aquí

La versión anterior de este doc proponía Oleada C como "cara, con
consentimiento": tablas `faceSearchConsent`/`userFaceEmbeddings`/
`facePhotoEmbeddings`, opt-in doble por email, indexado semanal de
embeddings, búsqueda por similitud coseno contra un índice persistente.

**Lo que existe en producción hoy consigue el mismo resultado para el
usuario (busca su cara en fotos de una carrera) sin nada de eso**: no hay
opt-in doble por email, no hay tablas de embeddings, no hay indexado
semanal — cada búsqueda calcula el embedding de la selfie en memoria (Modal,
`FaceRecognizer`), lo compara contra las fotos del álbum descargado en ese
mismo job, y descarta todo al terminar (§1, §7). Es una arquitectura más
simple y ya validada con tráfico real, pero **le falta la pieza de
consentimiento explícito** que sí tenía el diseño de Oleada C (ver
hallazgo real en §4) — eso sigue pendiente, aunque el resto de la
propuesta (tablas de indexado, cron semanal, revocación 1-click sobre un
índice persistente) ya no aplica porque no hay nada persistente que
revocar.

---

## 9. RGPD — checklist pendiente (actualizado: aplica a la feature YA en producción, no a un futuro Oleada C)

Pre-launch obligatorio, sigue sin marcarse ninguno (verificado 15 sep
2026, no solo copiado de la versión anterior):

- [ ] EIPD creada y firmada por asesor externo
      (`docs/legal/DPIA-photo-search.md` — no existe el archivo).
- [ ] `app/legal/privacidad/page.tsx` actualizado mencionando "Encuentra
      tus fotos" y el procesamiento facial — confirmado que hoy NO dice
      nada de esto (ver hallazgo §4).
- [ ] Checkbox de consentimiento explícito en
      `components/perfil/photo-search-upload-form.tsx` antes de subir
      selfies — confirmado que hoy no existe (ver hallazgo §4).
- [ ] Modal DPA con verificación de sede UE (`PHOTO_SEARCH_OPS.md` §1.2).
- [ ] ToS actualizado mencionando el feature y su consentimiento.
- [ ] Procedimiento documentado de "derecho al olvido" — en la práctica
      ya es casi trivial hoy porque no hay nada persistente: borrar un
      `photoSearchJobs` (ya hace `cancel`/cron de limpieza) es suficiente,
      no hay tabla de embeddings aparte que limpiar.
- [ ] Plan de breach response (qué pasa si el bucket de selfies se
      filtra) — mitigado en parte por el borrado inmediato de selfies al
      terminar el job (§7), pero sigue sin documentarse el procedimiento.

---

## 10. Riesgos y mitigaciones concretas (actualizado a la arquitectura real)

| Riesgo | Mitigación |
|---|---|
| Sanción AEPD por procesar caras sin consentimiento explícito | **Pendiente real, no solo teórico** — ver checklist §9. El pipeline borra selfies/embeddings al terminar cada job, pero eso no sustituye al consentimiento explícito previo que exige el Art. 9.2.a. |
| Derecho a la imagen del fotógrafo | Link-out por defecto (confirmado en código, §7: `photoUrl` es la URL original de Flickr). No copia fotos a Convex Storage. Respetar `externalPhotos` si se añade Sportmaniacs (ver `photo-sources.md` §5). |
| Falsos positivos facial | `include_identity_matches` + `FACE_GATE_THRESHOLD` en `findmyrace/matcher.py` — gate de cara antes de aceptar un match, no solo un umbral de score combinado. |
| Falsos negativos (gafas, sudor, dorsal no visible) | Ya combinado: el matching pondera cara+dorsal+color juntos (`MatcherWeights`), no solo uno. |
| Coste de compute por foto | Sin cron nocturno ni indexado persistente (§8) — el coste es por búsqueda, ya acotado por `MAX_PHOTOS_PER_JOB=1500` y el caché de álbumes entre búsquedas repetidas. |
| Carrera con fotógrafo profesional opuesto a scraping | No scrapear plataformas cerradas (`photo-sources.md` §3.2) — solo Flickr (público, sin paywall) y, si se implementa, Sportmaniacs/ChipLevante (mismo criterio: público, sin paywall). Partnership para el resto. |

---

## 11. Plan de adaptación a múltiples repos — movido a `photo-sources.md`

**Este plan ya no vive aquí duplicado.** El bloqueo que citaba esta
sección ("hacer esto DESPUÉS de Sprint 1") ya no aplica — Sprint 0+1 está
cerrado y validado con tráfico real (§1) — así que el plan concreto, con
datos reales del catálogo (2652 carreras, distribución por
`scraperAdapter`) y orden de prioridad por impacto/esfuerzo, está en
**`docs/optional/photo-sources.md` §7 "Plan concreto para maximizar
proveedores soportados"** (actualizado 15 sep 2026, decisión: adoptar el
máximo número de repositorios de fotos posible).

Resumen de esa decisión para quien lea solo este doc: Sportmaniacs
primero (2162 carreras, 81.5% del catálogo, `sportmaniacsEventIds` ya
cacheado — no depende de que nadie enlace un álbum a mano), luego
ChipLevante (113 carreras, mismo argumento), y en paralelo pedir que se
enlacen más álbumes de Flickr (`races.photosUrl`, hoy solo 1 de 2652).
No hay decisión técnica distinta por fuente para la parte facial de este
doc — el `FaceRecognizer` es el mismo independientemente de qué
`PhotoSource` trajo las fotos.

---

## 12. Referencias cruzadas

- `docs/plans/PHOTO_SEARCH_TECH.md` (schema, mutations, decisions)
- `docs/plans/PHOTO_SEARCH_PRD.md` (PRD, copy, user journey)
- `docs/plans/PHOTO_SEARCH_OPS.md` (RGPD, costes, rollout, riesgos)
- `docs/optional/photo-sources.md` (lista de proveedores detallada)
- `photo-search-api/findmyrace/` (código reutilizable)
- `photo-search-api/modal_app.py` (entrypoint Modal)
- `photo-search-api/api/find_photos.py` (FastAPI, mismo path que Modal)
- `find-my-race/src/findmyrace/` (versión original validada)
