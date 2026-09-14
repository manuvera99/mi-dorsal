# Ops plan: Encuentra tus fotos · mi-dorsal

> **Estado:** borrador — 12 sep 2026.
> **Temas:** RGPD/AEPD, costes operativos, rollout por fases, métricas, soporte, riesgos, contingencia.
> **Ref. funcional:** `docs/plans/PHOTO_SEARCH_PRD.md`. **Ref. técnica:** `docs/plans/PHOTO_SEARCH_TECH.md`.

---

## 1. Compliance RGPD / AEPD

### 1.1. ¿Esto es tratamiento de datos biométricos?

**Sí, técnicamente**: una selfie + un embedding facial generado por IA encajan en la definición de "dato biométrico" del Art. 4.14 GDPR.

**Pero NO es dato sensible del Art. 9**: el Art. 9.1 + Recital 51 GDPR especifican que el dato biométrico solo es "categoría especial" cuando se procesa **"con el propósito de identificar unívocamente a una persona"** (1:N). El procesamiento 1:1 (verificación: "¿esta cara coincide con la de mi base?") NO es Art. 9, es Art. 6 estándar.

**Nuestra feature es 1:1**: el usuario aporta su propia selfie (consentimiento explícito), se compara contra el álbum que él ha elegido, no construimos una base de datos biométrica de la población. Por tanto:
- **Base legal**: consentimiento explícito (Art. 6.1.a) + ejecución de contrato de suscripción Pro (Art. 6.1.b).
- **No requiere DPIA formal** pero la hacemos internamente como buena práctica (documentada en §1.5).
- **Sí requiere** transparencia reforzada (informar al usuario qué pasa con su selfie).

### 1.2. Qué tenemos que cambiar en el Privacy Policy

Añadir a `app/legal/privacidad/page.tsx`:

```markdown
## Búsqueda de fotos con IA (solo Pro)

Cuando usas la función "Encuentra tus fotos":

1. **Qué datos recogemos**: 1-3 selfies que tú subes, tu dorsal (si lo indicas),
   y el embedding facial generado por nuestro modelo de IA.
2. **Para qué los usamos**: únicamente para encontrar fotos donde apareces en
   el álbum de la carrera que tú has seleccionado.
3. **Cómo los procesamos**: las selfies se envían a nuestro proveedor de IA
   (Modal Labs, infraestructura en UE) que ejecuta InsightFace. El embedding
   se genera en tiempo real y no se persiste.
4. **Cuánto tiempo los guardamos**: las selfies y el embedding se eliminan
   automáticamente 24h después de la búsqueda. Los resultados (URLs de fotos)
   se conservan en tu perfil hasta que los borres.
5. **Con quién los compartimos**: con nadie. Nunca vendemos, alquilamos ni
   compartimos tus selfies o embeddings.
6. **Tu derecho al olvido**: puedes borrar cualquier búsqueda y sus resultados
   desde `/perfil/fotos` en cualquier momento.
7. **Base legal**: consentimiento explícito (marcando "Acepto" antes de subir
   las selfies) + ejecución del contrato Pro.

Proveedor de IA: Modal Labs Inc. (alojamiento UE). Encargado del tratamiento
con DPA firmado (incluido en https://modal.com/legal).
```

### 1.3. Consentimiento explícito en UI

Antes de subir selfies, checkbox obligatorio (no pre-marcado, como la AEPD exige desde el caso Yoti):

```tsx
<label className="flex items-start gap-2 text-sm">
  <input
    type="checkbox"
    required
    className="mt-1"
    onChange={(e) => setConsent(e.target.checked)}
  />
  <span>
    Acepto que mi-dorsal procese mis selfies con IA (InsightFace) para
    encontrar mis fotos en esta carrera. Las fotos y el embedding se
    borrarán automáticamente en 24h. Más info en nuestra{" "}
    <a href="/legal/privacidad" className="underline">política de privacidad</a>.
  </span>
</label>
```

Botón submit disabled hasta que el checkbox esté marcado.

### 1.4. Logs de consentimiento (Art. 7.1 GDPR)

Cada búsqueda debe guardar evidencia del consentimiento. En Convex, añadir a `photoSearchJobs`:

```ts
consentGivenAt: v.number(),       // timestamp del checkbox
consentVersion: v.string(),        // "v1.0-2026-09-12" — versionamos el texto
consentIpHash: v.optional(v.string()),  // SHA-256 de IP, no IP raw
```

El `consentVersion` permite demostrar QUÉ texto aceptó el usuario si la policy cambia. Si cambiamos el texto, incrementamos versión y pedimos re-consentimiento.

### 1.5. DPIA interna (Data Protection Impact Assessment)

No obligatoria (no es Art. 9), pero la hacemos porque toca datos biométricos y porque la AEPD valora buenas prácticas.

Documento de 2 páginas en `docs/legal/DPIA-photo-search.md` (a crear en sprint 0):

1. **Descripción del tratamiento**: subida de selfie → embedding → comparación con álbum → resultados al usuario.
2. **Necesidad y proporcionalidad**: sí, alternativa menos intrusiva (búsqueda manual) existe pero es fricción enorme. Proporcional.
3. **Riesgos**:
   - **R1**: selfie robada de un data breach → embeddings no persistidos minimizan daño.
   - **R2**: correlación entre embeddings de distintos jobs del mismo usuario → no, embeddings descartados por job.
   - **R3**: álbum del organizador contiene fotos de terceros sin su consentimiento → no es nuestro problema (él subió el álbum), pero añadimos disclaimer al usuario.
   - **R4**: uso indebido (alguien sube selfies de otra persona) → mitigado por Pro-gated y dorsal verificado en `myRaces`.
4. **Medidas de mitigación**: retention 24h, no persistencia de embeddings, Pro-gated, rate limit, IP hash, audit log.
5. **Consulta a AEPD**: no requerida, pero dejamos la puerta abierta si emergen quejas.

### 1.6. Riesgo AEPD: el precedente Yoti (2025)

La AEPD multó a Yoti en 2025 por:
1. Retención excesiva de embeddings biométricos.
2. Pre-ticked consent boxes (invalidan consentimiento).
3. Falta de opt-in genuino para uso en R&D.
4. Recogida de geolocalización sin justificación.

**Mitigación concreta en nuestro diseño:**

| Issue Yoti | Nuestra mitigación |
|---|---|
| Retención excesiva | 24h hard limit + cron de limpieza diario |
| Pre-ticked consent | Checkbox required, vacío por defecto |
| Uso para R&D sin opt-in | Nunca usamos selfies/embeddings para entrenar modelos |
| Geolocalización innecesaria | No recogemos IP raw, solo hash SHA-256 para audit |

**Conclusión**: nuestro diseño evita los 4 issues que motivaron la multa. Riesgo regulatorio bajo, pero documentado.

## 2. Costes operativos

### 2.1. Modal serverless (A10G, ~$0.0005/seg)

**Benchmarks de `find-my-race`** (validado en tu hardware local):
- InsightFace `buffalo_l` con `ctx_id=-1` (CPU): ~700 ms/foto
- InsightFace con `ctx_id=0` (GPU A10G): ~80 ms/foto (8.6× speedup)
- EasyOCR CPU: ~400 ms/foto
- EasyOCR GPU: ~50 ms/foto (8× speedup)
- Combined pipeline por foto: ~130 ms GPU, ~1100 ms CPU

**Estimaciones de coste por job** (álbum medio 3.000 fotos):

| Config | Duración job | Coste/job | Coste/mes (100 jobs) |
|---|---|---|---|
| A10G (1 GPU) | ~6.5 min (390s) | $0.195 | $19.50 |
| A10G (2 GPUs) | ~3.3 min (195s) | $0.195 | $19.50 (mismo coste total, más rápido) |
| A100 (1 GPU) | ~3.5 min (210s) | $0.294 | $29.40 |
| T4 (1 GPU, barato) | ~12 min (720s) | $0.162 | $16.20 |
| CPU (sin GPU) | ~55 min | $0.018 | $1.80 (latencia inaceptable) |

**Recomendación**: **A10G con 1 GPU**. Balance coste/latencia óptimo. Si la latencia molesta en beta, subir a 2 GPUs paralelas.

> **Corrección de coste importante (13 sep 2026):** la tabla de arriba solo
> cuenta el tiempo de *matching* (cara+dorsal+color), no el de **descargar
> el álbum**, que en la práctica no es instantáneo. Con la implementación
> real y ya arreglada (`find-my-race/src/findmyrace/sources/flickr.py`,
> API REST + retry/backoff ante 429), descargar un álbum de ~500 fotos tardó
> varios minutos en pruebas reales — Flickr aplica rate-limiting real al
> pedir 300+ fotos seguidas, y el backoff exponencial ante 429 alarga esa
> descarga bastante más que "unos segundos". **Si esa descarga ocurre dentro
> de la misma función Modal con GPU ya activa (como asume §6.2 del doc
> técnico), se está pagando GPU ociosa todo ese tiempo** — el coste real por
> job podría ser 2-4× la estimación de la tabla, no solo para álbumes
> gigantes sino para cualquier álbum de 300+ fotos, que no es un caso raro.
> **Mitigación recomendada**: separar la descarga (función Modal CPU-only,
> barata, ~$0.00005/seg) del matching (función GPU, solo se invoca con las
> fotos ya en disco/volumen compartido). Esto no estaba en el diseño
> original de TECH.md §1/§6 y habría que añadirlo antes de fijar precios.

### 2.2. Almacenamiento (Convex File Storage)

- Selfies temporales: ~2 MB × 3 × 1.000 jobs = 6 GB/mes
- Convex cobra $0.10/GB-mes → ~$0.60/mes (despreciable)
- TTL de 24h minimiza storage real a ~200 MB en cualquier momento

### 2.3. Email (Resend)

- 1 email por job con resultados (solo si `resultCount >= 1`)
- ~500 emails/mes en beta, ~5.000/mes en steady state
- Resend cobra $0.40/1.000 emails → ~$2/mes en steady state

### 2.4. Total proyección 12 meses

| Fase | Jobs/mes | Coste GPU | Storage | Email | Total |
|---|---|---|---|---|---|
| Beta cerrada (sem 7-8) | 50 | $10 | $0.10 | $0.02 | **$10/mes** |
| Mes 1 post-lanzamiento | 200 | $40 | $0.40 | $0.08 | **$40/mes** |
| Mes 3 | 500 | $100 | $1 | $0.20 | **$101/mes** |
| Mes 6 (1.500 Pro × 0.3 uso/mes) | 1.500 | $293 | $3 | $0.60 | **$297/mes** |
| Mes 12 (3.000 Pro) | 3.000 | $585 | $6 | $1.20 | **$592/mes** |

**Comparado con ingreso Pro**: 1.500 Pro × 4,99 €/mes = 7.485 €/mes. Margen 96%. Incluso triplicando uso (4.500 jobs/mes), margen sigue en 92%.

### 2.5. Costes ocultos que vigilamos

- **Cold-start Modal**: primera invocación tarda 5-15s (descarga modelos). Mitigar con warm-up programado cada 10 min (cuesta $0.001 cada warm-up = $1.50/mes, asumible).
- **Tráfico Vercel**: las páginas `/perfil/fotos/*` añaden bytes pero Vercel escala gratis en Hobby/Pro hasta 1 TB bandwidth/mes. No es problema.
- **Convex reads**: el polling cada 3s × 90s medio = 30 reads/job. A 1.500 jobs/mes = 45k reads/mes extra. Plan Convex actual aguanta.
- **Rate-limiting de Flickr (nuevo, 13 sep 2026)**: confirmado en pruebas reales — Flickr devuelve 429 con frecuencia real al descargar 300+ fotos seguidas desde la misma IP. Con retry/backoff esto se resuelve pero alarga la descarga (ver §2.1 arriba); sin retry, se pierden fotos que sí existen. Si Modal comparte IP saliente entre invocaciones concurrentes (varios usuarios buscando en el mismo álbum a la vez, p. ej. tras el email de "ya están las fotos"), el rate-limit podría ser más agresivo que en las pruebas de un solo proceso local — no verificado a esa escala.

## 3. Rollout por fases

### Fase 0: dev local (sem 1-6)

- Todo en worktree `feature/photo-search`
- Deploy de Modal en ambiente dev (`mi-dorsal-dev.modal.run`)
- Convex dev deployment
- Tests manuales con tus selfies y álbumes reales
- **No llega a usuarios**

### Fase 1: beta cerrada (sem 7)

**Criterio de paso a beta**:
- ✅ Build limpio en Vercel
- ✅ `npx convex deploy` sin errores
- ✅ Modal endpoint responde en <2s cold-start
- ✅ Test E2E con 5 selfies + álbum de 500 fotos → 4 resultados correctos
- ✅ Email llega a Resend
- ✅ Privacy policy actualizada en `/legal/privacidad`

**Usuarios beta** (10):
- Tú (Manu) + 2-3 Bull Runners de confianza
- 5-7 usuarios Pro actuales (cuando existan) o early adopters del Pro launch
- Acceso vía link directo `/perfil/fotos` con bypass temporal del paywall (flag `PHOTO_SEARCH_BETA_USERS`)

**Métricas a vigilar**:
- Tasa de éxito (≥1 match): target ≥60%
- Tiempo medio job: target <90s
- Errores Modal: target <5%
- Satisfacción cualitativa: NPS ≥40 en mini-encuesta (1 pregunta, in-app)

### Fase 2: rollout público (sem 8+)

**Criterio de paso a público**:
- ✅ Beta cerrada sin issues críticos
- ✅ Tasa de éxito ≥60% mantenida en 50+ jobs
- ✅ Coste GPU se mantiene <$50/mes en beta
- ✅ Privacy policy revisada por abogado (inversión mínima, ver §5)

**Estrategia de comunicación**:
1. **Email a Pro actuales**: "Nuevo en Pro: encuentra tus fotos con IA"
2. **Post en blog "Historias de dorsal"**: "Cómo la IA te encuentra en la línea de meta" (transparencia)
3. **Newsletter mensual**: incluir como highlight
4. **Redes (@midorsal)**: 1-2 posts demostrativos (con permiso del beta tester)
5. **No Product Hunt** todavía (esperar a tener 50+ Pro)

### Fase 3: iteración (mes 3-12)

- Optimizar latencia (caché de embeddings a nivel de usuario con consentimiento explícito)
- A/B test de copy en emails
- Expandir fuentes de álbum (FotoOwl partnership, integración con fotógrafo)
- Soporte multi-idioma (catalán, euskera, gallego) si hay tracción
- Versión mobile (PWA installable, ideal para subir selfie in-situ)

## 4. Métricas y monitoring

### 4.1. KPIs principales (dashboard `/admin/photo-search`)

| Métrica | Target | Frecuencia |
|---|---|---|
| Búsquedas iniciadas/mes | 100-500 mes 1, 1.500 mes 6 | Real-time |
| Tasa de éxito (≥1 match) | ≥60% | Diaria |
| Tiempo medio job (end-to-end) | <90s | Diaria |
| Tasa de error Modal | <5% | Diaria |
| Coste GPU total/mes | <$50 mes 1, <$300 mes 6 | Real-time |
| Conversion rate free→Pro atribuido a feature | ≥5% | Semanal |
| Churn Pro por satisfacción con feature | <10% | Mensual |

### 4.2. Eventos a trackear (PostHog o equivalente)

```ts
// Al crear job
track("photo_search_created", {
  userId, raceId, selfieCount, hasDorsal, albumSource,
});

// Al completar job
track("photo_search_completed", {
  jobId, status, resultCount, durationMs, gpuCostUsd, userId,
});

// Al ver resultados
track("photo_search_results_viewed", { jobId, resultCount, userId });

// Al descargar foto individual
track("photo_search_photo_downloaded", { jobId, photoScore, userId });
```

### 4.3. Logs estructurados (console con prefijo)

Todos los logs del feature empiezan con `[photo-search]`:

```
[photo-search] job ps_abc123 created by user_X for race_Y (3 selfies, dorsal 429)
[photo-search] Modal started for ps_abc123 (A10G, ETA 60s)
[photo-search] Modal done for ps_abc123: 4 results in 67s, cost $0.034
[photo-search] cleanup deleted 47 jobs (24h TTL exceeded)
```

### 4.4. Alertas (email simple a Manu)

Implementar con `convex/crons/` + `emailDispatch`:

- **Alerta A**: tasa de error >20% en última hora
- **Alerta B**: coste GPU diario >$5 (anormal, investigar)
- **Alerta C**: job >5min sin completar (probable hung en Modal)
- **Alerta D**: 0 jobs en 24h (posible rotura silenciosa)

Umbrales se afinan durante beta.

## 5. Legal — revisión humana obligatoria

**No escatimes en esto.** Antes de fase 2 (público):

1. **Privacy policy** revisada por abogado con experiencia RGPD (coste ~300-500 € por revisión, 1-2 h de trabajo).
2. **DPA con Modal Labs**: revisar https://modal.com/legal/dpa. Confirmar que:
   - Alojamiento EU disponible (region `eu-west`).
   - Sub-procesadores listados (AWS, GCP).
   - Cláusula de breach notification <72h.
3. **Términos Pro** actualizados para incluir el feature.
4. **Cookie policy**: no usamos cookies nuevas, pero verificar.
5. **ToS de la API de Flickr** (nuevo, 14 sep 2026): confirmar con el
   abogado si escanear 300-500 fotos por búsqueda server-side cae dentro
   de un uso razonable frente a la cláusula de "no mostrar más de 30 fotos
   por página / no usar bandwidth no razonable" — ver R8 más abajo. No
   bloqueante para beta cerrada, sí antes de rollout público.

**Presupuesto**: 500-1.000 € en revisión legal inicial + 200 €/año en mantenimiento.

## 6. Riesgos y planes de contingencia

### R1: Modal se cae o cambia pricing

**Probabilidad**: baja (Modal tiene 99.9% SLA en plan Pro).
**Impacto**: alto (feature caído).
**Mitigación**: feature flag `NEXT_PUBLIC_PHOTO_SEARCH_ENABLED=false` para apagado instantáneo. Plan B: migrar a RunPod serverless (mismo concepto, 1-2 días de trabajo). Plan C: AWS Lambda + Rekognition (último recurso, peor RGPD).

### R2: InsightFace o EasyOCR fallan en condiciones reales

**Probabilidad**: media (selfies de baja calidad, dorsales tapados).
**Impacto**: medio (tasa de éxito <40%, NPS negativo).
**Mitigación**: A/B test en beta con thresholds más permisivos (0.25 en vez de 0.30). Si aún falla, prompt al usuario "tu selfie está borrosa, sube otra". Si sigue, evaluar PaddleOCR para dorsales.

> **Caso real ya visto (13 sep 2026):** si la foto de referencia que sube el
> usuario tiene varias caras (p. ej. una foto de meta con gente detrás en
> vez de un selfie limpio), el pipeline puede devolver 0 resultados aunque
> el usuario sí aparezca en el álbum — se confirmó con un caso real donde el
> embedding de referencia quedaba contaminado por caras de desconocidos de
> fondo. Ya está arreglado en `find-my-race` (se usa solo la cara de mayor
> bbox), pero conviene además avisar en la UI si se detecta >1 cara en el
> selfie subido, en vez de asumir en silencio cuál es la persona correcta.

### R3: Costes GPU se disparan (spam, bug, ataque)

**Probabilidad**: baja (Pro-gated + rate limit 20/día).
**Impacto**: alto (factura sorpresa).
**Mitigación**: alertas B en tiempo real + kill switch en Modal (limitar concurrent jobs). Plan B: cap mensual en código (ej: máx 100 jobs/usuario/mes).

### R4: AEPD abre investigación por queja de usuario

**Probabilidad**: muy baja (diseño RGPD-compliant).
**Impacto**: alto (multa + daño reputacional).
**Mitigación**: DPIA documentada + logs de consentimiento + retención 24h. Si pasa, tener respuesta legal lista en 48h.

### R5: Un fotógrafo se queja de que enlazamos a sus fotos sin permiso

**Probabilidad**: media.
**Impacto**: medio (DMCA, retirada de álbum).
**Mitigación**: en TOS del organizador aclarar que "el enlace a tu álbum se facilita con fines de descubrimiento". Añadir `rel="noopener noreferrer"` en thumbnails.

> **Matiz importante (13 sep 2026):** esta mitigación asume que solo
> "enlazamos" al álbum. Pero el diseño real (TECH.md §1/§6) **descarga las
> fotos completas** del fotógrafo a través de un endpoint propio (Modal) para
> hacer el matching — no es un simple link, es una copia temporal del
> contenido de un tercero en nuestra infraestructura. Además, al menos dos
> proveedores reales del catálogo (fotoscarreras.com, QuieroMisFotos.com) ya
> ofrecen su propio "sube tu selfie" — si mi-dorsal descarga sus fotos para
> ofrecer lo mismo, el riesgo deja de ser solo "enlazar sin permiso" y pasa a
> ser "reproducir el servicio de pago de un tercero usando su propio
> contenido". Para los proveedores de pago, este riesgo es más alto que la
> mitigación actual contempla. Para el canal Flickr (fotógrafos aficionados
> sin modelo de negocio, ver TECH.md §14.3), el riesgo sigue siendo bajo,
> como ya decía este documento.

### R6: Selfies se quedan en Convex Storage por bug

**Probabilidad**: baja (cron diario + código revisado).
**Impacto**: alto (RGPD breach).
**Mitigación**: monitor de storage: si `photoSearchJobs.count + selfies en storage > N` → alerta. Tests E2E del cron de cleanup.

### R7: Flickr cambia su API interna o retira el site_key público (nuevo, 13 sep 2026)

**Contexto**: la descarga de álbumes (ver `PHOTO_SEARCH_TECH.md` §15.1) usa
la API REST oficial de Flickr autenticada con el `site_key` público que el
propio frontend de flickr.com expone en el HTML de cada álbum, más una
resolución de NSID a partir del mismo HTML (necesaria porque las URLs que
comparten los fotógrafos casi siempre usan un alias, no el ID numérico —
ver TECH.md §15.1.1). No es una API key contratada por mi-dorsal — es la
misma que usa cualquier visitante del sitio, extraída dinámicamente. Esto
es más robusto que el scraping de UI que había antes (Playwright
simulando clicks), pero sigue dependiendo de una convención interna de
Flickr, no de un contrato.

**Probabilidad**: baja-media (Flickr lleva años sin cambiar este patrón,
pero es una empresa con recursos de ingeniería limitados y podría cambiarlo
sin aviso).
**Impacto**: medio — hay un fallback automático (scraper HTML por página) que
sigue funcionando, pero con la limitación conocida de no cubrir álbumes
grandes completos (topa en ~120 fotos de un álbum de 500, ver TECH.md §14.2).
**Mitigación**: el propio código ya cae al fallback sin intervención manual
si la extracción del site_key o del NSID falla. Monitorizar en logs cuántos
jobs caen al fallback (`[flickr] API no disponible, usando fallback HTML
por página`) como señal temprana de que Flickr cambió algo, antes de que
se note en tasa de éxito.

### R8: rate-limiting del CDN de imágenes de Flickr y zona gris de ToS (nuevo, 14 sep 2026)

**Contexto**: `live.staticflickr.com` (donde se descargan las imágenes en
sí, no la API REST) devuelve 429 con frecuencia real al descargar 300+
fotos seguidas de un mismo álbum desde la misma IP — confirmado
empíricamente, sin límite documentado públicamente por Flickr para este
CDN (a diferencia de la API REST, que sí documenta 3.600 llamadas/hora por
key — irrelevante aquí, se usan 1-2 llamadas por álbum). Además, los ToS de
la API de Flickr prohíben explícitamente "mostrar más de 30 fotos por
página" y "usar una cantidad no razonable de bandwidth" — nuestro caso de
uso (escanear el álbum completo server-side, sin mostrar al usuario más que
las fotos con match) es una zona gris frente a esa cláusula, no un uso
explícitamente amparado.

**Probabilidad**: alta de que ocurran 429 puntuales en álbumes grandes
(ya observado); baja de que Flickr banee la IP/key por completo si se
respeta el backoff.
**Impacto**: medio — sin mitigación, se pierden fotos reales del álbum
(observado: hasta 16% de pérdida en un álbum de 297 fotos sin backoff
adaptativo). Impacto legal/reputacional si Flickr interpreta el uso como
incumplimiento de ToS: bajo-medio, no cuantificado.
**Mitigación aplicada** (ver TECH.md §15.6): reutilización de sesión HTTP
(~37% más rápido, menos conexiones nuevas por segundo) + backoff adaptativo
entre descargas (el delay sube tras un 429 y se relaja tras una racha sin
problemas). Medido end-to-end: mismo álbum real de 297 fotos, de 250/297
(84%) a 296/297 (99.7%) con estas mitigaciones.
**Pendiente, no bloqueante para el MVP**: revisión legal explícita de si el
volumen de fotos escaneadas por búsqueda cae dentro de un uso razonable de
los ToS de Flickr — añadir a la revisión legal de §5 antes de rollout
público (no solo beta cerrada).

## 7. Soporte al usuario

### 7.1. FAQ (incluir en `/perfil/fotos` y en email de resultados)

- **¿Qué pasa con mi selfie?** — Se usa para buscar tus fotos y se borra automáticamente en 24h. Nunca la compartimos.
- **¿Por qué no encuentra mis fotos?** — Tu dorsal puede no estar visible, o el álbum aún no incluye meta. Prueba con más selfies o espera al álbum completo.
- **¿Puedo usar una foto de hace años?** — Sí, pero mejor fotos recientes con luz clara.
- **¿Funciona con gafas de sol?** — Sí, InsightFace las detecta. Gorras o máscaras reducen la tasa de éxito.
- **¿Cuánto tarda?** — Entre 30 segundos y 2 minutos dependiendo del álbum.

### 7.2. Canal de soporte

- Email a `hola@mi-dorsal.com` (cuando Zoho esté configurado).
- Reply-to en emails del feature = mismo email.
- Sin chat en vivo (no escala). Si el usuario está frustrado, escalación manual.

### 7.3. Plantilla de respuesta para issues comunes

```
Asunto: Re: tus fotos de [Carrera]

Hola [nombre],

Gracias por probar "Encuentra tus fotos". Lamento que no haya funcionado
en tu caso.

[Para "0 fotos encontradas"]:
- Verifica que tu dorsal era visible en la carrera
- Prueba con una selfie más reciente y bien iluminada
- Si el álbum aún no tiene fotos de meta, espera unos días

[Para "error técnico"]:
- Estamos revisándolo. ¿Puedes compartir el ID del job? (ps_abc123)

Un saludo,
Manu, en mi-dorsal
```

## 8. Checklist pre-lanzamiento (sem 8)

### Producto
- [ ] UI pulida en desktop y mobile (test con 3 devices)
- [ ] Empty states implementados (0 resultados, error, etc.)
- [ ] Loading states con progreso real
- [ ] Paywall copy específico

### Técnico
- [ ] `npm run build` limpio local
- [ ] `npx tsc --noEmit` limpio
- [ ] `npx convex deploy` sin errores
- [ ] Modal deploy en `mi-dorsal-prod.modal.run`
- [ ] Env vars configuradas en Vercel + Convex + Modal
- [ ] Cron de cleanup registrado y verificado
- [ ] Logs estructurados en producción
- [ ] Alertas A, B, C, D probadas (forzando errores manualmente)
- [ ] Privacy policy actualizada
- [ ] Kill switch `PHOTO_SEARCH_ENABLED` probado (apagar y verificar UX)

### Legal
- [ ] Privacy policy revisada por abogado
- [ ] DPA con Modal verificado
- [ ] Términos Pro actualizados
- [ ] Consentimiento checkbox funcional y loggeado

### Operativo
- [ ] Email de soporte `hola@mi-dorsal.com` funcionando
- [ ] Beta cerrada con ≥5 usuarios sin issues críticos
- [ ] Dashboard `/admin/photo-search` con métricas reales
- [ ] Post de blog draft listo

### Métricas baseline
- [ ] Capturar métricas de 1 semana de beta para baseline
- [ ] Calcular unit economics reales (coste/job, margen)
- [ ] Comparar con proyección §2.4

### Go/No-Go
- [ ] **GO**: todos los checkboxes anteriores + NPS beta ≥40
- [ ] **NO-GO**: si tasa de éxito <40%, costes >$100/mes en beta, o issue RGPD sin resolver

## 9. Out of scope para Y1

- App nativa iOS/Android (la PWA debería bastar)
- Anti-spoofing (no justificado a esta escala)
- Vídeo de carrera (otro stack)
- Marketplace de fotos (el fotógrafo vende, nosotros no intermediamos)
- Reconocimiento corporal completo (gait, ropa) — solo cara + dorsal + color

## 10. Resumen ejecutivo para Manu

> **Actualización (13 sep 2026)** — 3 cosas cambiaron desde la aprobación del
> 12 sep tras validar el pipeline real contra álbumes de Flickr:
> 1. **Alcance real más pequeño**: solo álbumes de Flickr tienen downloader
>    viable. Los proveedores de pago del catálogo (fotoscarreras.com,
>    QuieroMisFotos...) no están cubiertos y, en varios casos, ya ofrecen
>    su propio selfie-search — competir con ellos raspando su contenido es
>    un riesgo mayor de lo que R5 asumía originalmente (ver arriba).
> 2. **Coste de GPU probablemente subestimado**: la descarga del álbum (antes
>    tratada como instantánea) tarda varios minutos en álbumes de 300+ fotos
>    por rate-limiting real de Flickr — si esa espera ocurre con la GPU ya
>    activa, el coste real por job puede ser 2-4× la tabla de §2.1.
> 3. **2/30 tareas de Sprint 0 ya hechas**, pero en `find-my-race`, no en
>    mi-dorsal — el fix de reconocimiento facial y el fix de paginación de
>    Flickr, ver `PHOTO_SEARCH_TECH.md` §14.
>
> Nada de esto invalida la aprobación original, pero conviene revisar el
> alcance (¿solo Flickr, o vale la pena el esfuerzo de una UI de subida de
> organizador para cubrir el resto?) antes de Sprint 1.

> **Actualización 2 (14 sep 2026)** — sesión de validación con un positivo
> real (Manu, dorsal 1282, álbum "Memorial JM Zambrana") + mejoras de bajo
> coste. Resumen (detalle completo en `PHOTO_SEARCH_TECH.md` §15):
> 1. **Bug de threshold encontrado y arreglado**: el umbral real de gate de
>    cara era 0.35 en todas las búsquedas hechas hasta ahora, no el 0.30
>    documentado — una llamada interna no pasaba el parámetro explícito.
> 2. **La calidad de la selfie de referencia es la palanca más rentable**:
>    validado con datos reales — cambiar 4 fotos de referencia malas (de
>    carrera, pequeñas) por selfies limpios casi duplicó el score (0.29-0.35
>    → 0.57-0.59) en las mismas fotos objetivo. Más impacto que cualquier
>    ajuste de modelo probado. **Implicación de producto**: el formulario de
>    subida de selfie en mi-dorsal debe pedir 2 fotos con roles explícitos
>    (frontal + lateral) y validar su calidad antes de aceptar el job — ver
>    TECH.md §15.3, decisión de arquitectura pendiente (¿Convex o Modal?).
> 3. **Mejora de precisión sin coste relevante**: segunda pasada de "zoom"
>    solo en casos ambiguos (0.4% de las fotos de un álbum real) — nunca
>    empeora, mejora los casos límite.
> 4. **Rate-limiting de Flickr mitigado**: de 84% a 99.7% de cobertura de
>    descarga en el mismo álbum real, con sesión HTTP reutilizada y backoff
>    adaptativo. Nueva zona gris de ToS identificada (R8) — no bloqueante
>    para MVP, sí para revisión legal antes de rollout público.
> 5. **3/30 tareas de Sprint 0 ya hechas** en `find-my-race` (no en
>    mi-dorsal todavía).

**Lo que pido aprobar para arrancar sprint 0 (sem 1)**:

1. ✅ Naming tentativo: "Encuentra tus fotos" / "Mis fotos de carrera"
2. ✅ Pro-only con rate limit 20/día
3. ✅ Modal serverless A10G, región EU
4. ✅ Retención 24h + consentimiento explícito
5. ✅ Presupuesto legal: 500-1.000 € para revisión inicial
6. ✅ Beta cerrada con 5-10 usuarios antes de público

**Lo que pido resolver en sem 4 (antes de beta cerrada)**:

1. Naming final del feature
2. ¿Thumbnails inline en email o links?
3. ¿Guardar resultados en perfil del usuario o solo email?
4. ¿Búsqueda sobre álbumes sin dorsal inscrito?

**Timeline**: 6-8 semanas desde aprobación hasta rollout público.
**Inversión inicial**: ~1.000 € (legal) + tiempo de Manu (4-6 h/semana).
**ROI esperado**: 12 meses con 1.500 Pro → 7.485 €/mes ingreso vs ~297 €/mes coste GPU. Margen 96%.
