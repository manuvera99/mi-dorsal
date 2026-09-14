# PRD: Encuentra tus fotos de carrera · mi-dorsal

> **Estado:** borrador — 12 sep 2026.
> **Naming candidato:** **"Encuentra tus fotos"** (botón) / **"Mis fotos de carrera"** (sección perfil) / **"Fotos encontradas"** (email).
> **Pricing:** **Pro only**. Feature detrás de `<Paywall>` desde el día 1.
> **Tagline del feature:** *"Sube tu selfie, te encontramos en la línea de meta."*
> **Ref. voz:** `docs/core/brand-voice.md` — tuteo, sin postureo, "tu dorsal" en lugar de "su dorsal" cuando hablamos al corredor.
> **Ref. técnica:** `docs/plans/PHOTO_SEARCH_TECH.md`. **Ref. operativa:** `docs/plans/PHOTO_SEARCH_OPS.md`.

---

## 1. Por qué este feature

Tienes 2.761 carreras indexadas, ~200 usuarios registrados, 0 Pro pagando. El problema no es adquisición, es **profundidad del momento emocional del corredor**. El instante entre cruzar la meta y abrir Strava es una ventana de dopamina pura. Quien la captura, gana al corredor.

Hoy mi-dorsal avisa "ya están las fotos de la carrera" pero redirige a la galería del fotógrafo. El corredor llega, busca su dorsal entre 3.000 fotos, se frustra a los 5 minutos y se va. **Le estás quitando el trabajo que la app debería hacer por él.**

Strava no lo hace (Strava no vende fotos). Correbirras no lo hace (no tiene IA). Runedia no lo hace. FotoOwl, Flashframe, SnapSeek lo hacen pero **no en español**, **no atado a la identidad del corredor** (su dorsal verificado), **no atado al "resultado oficial"**. Esa es la grieta.

**Diferenciador único:** el corredor ya está identificado en mi-dorsal con su dorsal verificado en `myRaces`. La selfie + el dorsal verificado + el catálogo de carreras es una combinación que nadie más tiene.

> **Corrección (13 sep 2026, tras investigar proveedores reales del catálogo):**
> este diferenciador es más débil de lo que parece. Al menos un proveedor que
> ya usan organizadores del propio catálogo de mi-dorsal —
> **fotoscarreras.com**, usado en Benidorm Half — **ya ofrece "sube tu selfie
> para ver tus fotos" con reconocimiento facial propio**, con el mismo
> disclaimer de limitaciones que tendría cualquier pipeline InsightFace.
> QuieroMisFotos.com (usado en Mitja Marató Santa Pola) también anuncia
> "reconocimiento facial" en su propia web. No somos los únicos con esta
> combinación — en las carreras donde el fotógrafo ya lo ofrece, mi-dorsal
> competiría con el propio proveedor del organizador, no llenaría un vacío.
> El diferenciador real y defendible es más estrecho: **cubrir las carreras
> pequeñas/locales que suben las fotos gratis a Flickr y donde nadie ofrece
> búsqueda por selfie** (ver `PHOTO_SEARCH_TECH.md` §14.3). Conviene revisar
> el copy de esta sección con esa base más realista antes de usarlo en
> marketing.

## 2. Propuesta de valor (copy en la app)

### 2.1. Pitch corto (40 palabras)

> *"Sube tu selfie y tu dorsal. Te decimos en qué fotos sales de la línea de meta. Sin buscar entre miles, sin pagar al fotógrafo por fotos que no son tuyas. Solo Pro."*

### 2.2. Pitch medio (landing `/pro`)

> *"Acabas de cruzar la meta. Te has quitado el chip. Sudas. Lo único que quieres es ver las fotos. Con mi-dorsal Pro no pierdes 20 minutos buscando tu dorsal en la galería del fotógrafo. Subes tu selfie desde el móvil y te llegan las fotos donde sales, directo al email."*

### 2.3. Pitch en el email (cuando admin pega `photosUrl`)

> *"📸 Ya están las fotos de [Carrera]. Tienes dos opciones: (a) ir a la galería y buscar tu dorsal como en 2010, o (b) Pro: subes una selfie y te las mandamos a ti."*

### 2.4. Por qué Pro, no free

- El coste de GPU es real (~$0.10/búsqueda → a 1.000 búsquedas/mes son $100 = 92 €).
- Es un argumento claro de upgrade: "si quieres esta comodidad, Pro".
- Quien ha pagado Pro convierte mejor a largo plazo (señal de compromiso).
- Margen obsceno: a 4,99 €/mes Pro, 1.500 Pro × 1 búsqueda/semana = 7.485 €/mes ingreso vs ~230 €/mes GPU.

## 3. User journey completo

### 3.1. Trigger

**Tres puntos de entrada** (en orden de prioridad):

1. **Email "fotos disponibles"** (cron existente `notifyPhotosAvailable`) — añade CTA secundario: *"¿No encuentras tu dorsal? Pro: lo encontramos por ti."*
2. **Notificación push** (futuro) cuando admin pega `photosUrl` y el usuario tiene dorsal inscrito en esa carrera.
3. **Sección del perfil** `/perfil/fotos` — histórico de todas las carreras con `photosUrl` y botón "Buscar mis fotos" (gated Pro).

### 3.2. Flujo del usuario (happy path)

```
1. Usuario abre email "📸 Ya están las fotos de la Carrera X"
   └─ Click en CTA "Buscar mis fotos con IA" (Pro)
2. Llega a /perfil/fotos/[raceSlug]
   └─ Drag-and-drop zona: "Sube 1-3 fotos tuyas"
   └─ Campo pre-rellenado con su dorsal de myRaces
   └─ Tooltip: "Tu selfie se borra en 24h. No la compartimos."
3. Click "Buscar mis fotos"
   └─ Loading state: "Detectando tu cara (5s)..." →
                  "Buscando entre 2.847 fotos (45s)..." →
                  "Filtrando por tu dorsal 429 (20s)..."
4. Resultados: "Hemos encontrado 4 fotos donde sales"
   └─ Grid de thumbnails con score visible (97%, 92%, 88%, 81%)
   └─ Botón por foto: "Descargar" + "Guardar en mi perfil"
   └─ Email automático al email del usuario con thumbnails + link
5. Email: "📸 4 fotos te han encontrado en la Carrera X"
   └─ 4 thumbnails inline, link "Ver todas en mi-dorsal", "Descargar ZIP"
```

### 3.3. Flujo de error (no match)

```
"0 fotos encontradas. Posibles razones:
 - Tu dorsal 429 no aparece en ninguna foto (¿lo llevabas visible?)
 - La calidad de tus selfies es baja (intenta con luz frontal)
 - El álbum aún no incluye fotos de meta

¿Ampliar búsqueda? Pro: relaja el filtro de dorsal."
```

### 3.4. Flujo Pro expirado / no-Pro

```
Click "Buscar mis fotos"
  └─ Si NO es Pro: <Paywall> con copy específico + CTA "Hazte Pro"
  └─ Si Pro expirado: <Paywall> con copy de reactivación
  └─ Si Pro activo: flujo completo
```

## 4. Estructura de páginas (Next.js App Router)

| Ruta | Tipo | Auth | Pro? | Notas |
|---|---|---|---|---|
| `/perfil/fotos` | Página | Requerido | Sí | Histórico de carreras con `photosUrl` + estado de cada búsqueda |
| `/perfil/fotos/[raceSlug]` | Página | Requerido | Sí | UI de subida + resultados + historial de esta carrera |
| `/perfil/fotos/[raceSlug]/job/[jobId]` | Página | Requerido | Sí | Estado en tiempo real del job (polling cada 3s) |
| `/admin/photo-search` | Panel | Admin | n/a | Métricas: búsquedas/mes, tasa de éxito, jobs fallidos |

**Componentes nuevos:**
- `components/photo-search/PhotoSearchForm.tsx` — drag-and-drop + dorsal
- `components/photo-search/PhotoSearchResults.tsx` — grid de thumbnails con scores
- `components/photo-search/PhotoSearchProgress.tsx` — barra de progreso con fases
- `components/photo-search/PhotoSearchEmptyState.tsx` — no match, sugerir ampliar
- `components/photo-search/PhotoSearchPaywall.tsx` — wrapper con copy específico

> **Referencia de implementación (13 sep 2026):** `find-my-race/web/components/ProgressView.tsx`
> y `FindForm.tsx` ya implementan una versión funcional de este flujo (SSE en
> vivo, log de eventos, mini-galería de matches mientras se procesa, no solo
> polling) contra un backend FastAPI real. No es Convex/Next.js de mi-dorsal,
> pero es un punto de partida de UX/UI ya probado en vez de diseñar desde
> cero — vale la pena mirarlo antes de construir `PhotoSearchProgress.tsx`.

## 5. Modelo de copy (brand voice)

### 5.1. Tono

- **Tuteo siempre** ("sube tu selfie", "te encontramos").
- **Verbo en presente y futuro inmediato** ("encontramos", "te mandamos"), nunca imperativo frío.
- **Humor sutil de corredor** en empty states ("¿dónde estabas? ¿en la cámara o en la cinta?").
- **Transparencia radical** sobre la IA: nunca "te encontramos" a secas, siempre "te encontramos con IA (cara + dorsal)" al menos una vez.

### 5.2. Microcopy concreto

| Pantalla | Copy |
|---|---|
| Botón CTA email | "Buscar mis fotos con IA" |
| Heading formulario | "Sube 1-3 fotos tuyas" |
| Subheading | "Cuanto más clara sea tu cara, mejor te encontramos en la meta." |
| Dorsal placeholder | "Tu dorsal (ej: 429)" — pre-rellenado desde `myRaces` |
| Tooltip privacidad | "Tu selfie se usa solo para esta búsqueda. Se borra en 24h. Nunca la compartimos." |
| Botón submit | "Buscar mis fotos" |
| Loading fase 1 | "Detectando tu cara..." |
| Loading fase 2 | "Buscando entre X.XXX fotos..." |
| Loading fase 3 | "Filtrando por tu dorsal X..." |
| Resultado éxito | "Hemos encontrado N fotos donde sales" |
| Resultado parcial | "Hemos encontrado N fotos. ¿Quieres ampliar la búsqueda?" |
| Empty state | "0 fotos encontradas. ¿Tu dorsal estaba visible?" |
| Error álbum (no soportado) | "Esta carrera usa un proveedor de fotos que aún no soportamos automáticamente." |
| Error álbum (temporal) | "No hemos podido descargar el álbum ahora mismo. Vuelve a intentarlo en unos minutos." |

> **Nota (13 sep 2026):** hay dos causas de error de álbum bien distintas y
> conviene diferenciarlas en el copy, no fundirlas en un solo mensaje:
> (a) el `photosUrl` no es de Flickr → error permanente, no tiene sentido
> reintentar (ver `PHOTO_SEARCH_TECH.md` §14.3, solo Flickr tiene downloader
> hoy); (b) Flickr devuelve 429 (rate limit) al descargar álbumes grandes,
> algo confirmado en pruebas reales → error temporal, un reintento a los
> pocos minutos suele funcionar. El mensaje "el organizador aún no lo ha
> subido" de la versión anterior de este PRD no es correcto para ninguno de
> los dos casos reales — asumía una causa (álbum vacío) que no es la que se
> ha visto en la práctica.

## 6. Reglas de UX duras

1. **Máx 3 selfies por búsqueda.** Más = coste de GPU y diminishing returns.
2. **Cada selfie <5 MB, formatos JPG/PNG/WebP.** Validar client-side antes de subir.
3. **Selfies se borran a las 24h del job `done`.** Cron diario `cleanupPhotoSearch`.
4. **Búsqueda cap por usuario: 20/día.** Anti-abuso aunque sea Pro.
5. **Top-K=15 fotos por defecto.** Más es ruido, menos es perder matches.
6. **Score mínimo 0.30 cara.** Mismo umbral que `find-my-race` validado — pero
   ojo, "validado" significa 2 álbumes y 6 fotos-positivas del mismo
   fotógrafo (ver `PHOTO_SEARCH_TECH.md` §14.4); conviene re-confirmar el
   umbral con más muestra antes de fijarlo como definitivo. Además, el
   selfie de referencia debe ser una cara clara y sola — si sube una foto
   con varias personas, el pipeline usa solo la cara más grande (fix del
   13 sep 2026), pero eso puede no ser la persona correcta si el selfie es
   una foto de grupo con el usuario en segundo plano. Vale la pena avisar
   en la UI si se detectan >1 caras en la foto subida.
7. **No guardar embeddings de selfies en Convex.** Solo en memoria de Modal durante el job, descartados al terminar.
8. **Email solo si `job.status == 'done' AND resultCount >= 1`.** No spammear al corredor con "0 fotos encontradas".

## 7. Métricas de éxito (12 semanas post-lanzamiento)

| Métrica | Target | Por qué |
|---|---|---|
| Búsquedas Pro/mes | 100-300 (mes 1) → 1.500 (mes 6) | Validación de uso |
| Tasa de éxito (≥1 match) | ≥60% | Si <40%, el modelo falla o las selfies son malas |
| Tiempo medio de búsqueda | <90s end-to-end | UX, no hacer esperar al corredor |
| Conversión email→búsqueda | ≥8% | Click-through del CTA del email |
| NPS del feature (beta) | ≥40 | Cualitativo, en 10 corredores beta |
| Churn Pro motivado por este feature | ≥15% de Pro cite "fotos" como razón | Encuesta post-cancelación |

## 8. Out of scope (no hacer en MVP)

- ❌ **Búsqueda por texto/etiquetas** (ej: "busca fotos con mi gorra roja"). Demasiado complejo.
- ❌ **Compartir fotos en redes sociales desde la app.** El corredor ya tiene WhatsApp.
- ❌ **Edición de fotos** (filtros, recortador). No somos Photoshop.
- ❌ **Matching con Strava activities** (foto de actividad = foto de carrera). Out hasta tener integración nativa.
- ❌ **Búsqueda en vídeos de carrera.** Otro stack técnico.
- ❌ **Anti-spoofing** (verificar que la selfie es real, no una foto de otra persona). Con 1-3 selfies + dorsal verificado el riesgo es bajo.

## 9. Decisiones de naming abiertas (resolver en semana 4 con beta)

| Opción | Pro | Contra |
|---|---|---|
| **"Encuentra tus fotos"** | Claro, directo, SEO friendly ("cómo encontrar mis fotos de carrera") | Genérico |
| **"Mis fotos de carrera"** | Personal, possessive | Más largo, peor para SEO |
| **"Buscador de fotos con IA"** | Diferenciador técnico claro | Frío, suena a B2B |
| **"Tu álbum de meta"** | Emocional | Confuso con "álbum de Spotify" |

**Recomendación:** **"Encuentra tus fotos"** (botón) + **"Mis fotos de carrera"** (sección perfil). Resolver con feedback de beta en semana 7.

---

## 10. Preguntas para validar antes de programar

1. **¿El organizador de la carrera puede subir el álbum proactivamente o solo se scrapea de Flickr?**
   — **Respondida en parte (13 sep 2026):** hoy no hay UI de admin para subida
   directa, y no está en el plan de Sprint 0-6. Solo se scrapea de Flickr, y
   solo Flickr — el resto de proveedores reales del catálogo (fotoscarreras.com,
   barrel.cloud, QuieroMisFotos...) no tienen downloader ni implementado ni
   planeado (ver `PHOTO_SEARCH_TECH.md` §14.3). Si se quiere cubrir esos
   proveedores, la única vía realista a corto plazo es que el organizador
   suba el álbum directamente a mi-dorsal — eso sí requeriría la UI de admin
   que esta pregunta original planteaba, y no está diseñada.
2. **¿El usuario puede borrar una foto encontrada de su perfil?** (derecho al olvido RGPD del resultado) — sigue abierta.
3. **¿Las fotos encontradas se guardan en el perfil del usuario o solo se le mandan por email?** (storage vs email-only) — sigue abierta.
4. **¿Se permite búsqueda sobre álbumes sin dorsal verificado?** (ej: carrera a la que no estoy apuntado)
   — **Relevante para el diseño del email de resultados:** si se permite
   buscar sin `myRace` asociada, el email "te encontramos" (`photosFound.ts`,
   ver `PHOTO_SEARCH_TECH.md` §4) no tiene a qué `myRaceId` enganchar el log
   de notificación (`dispatchAndLog` lo exige obligatorio hoy) — hay que
   decidir esto antes de escribir esa mutation, no durante el sprint de
   implementación.

Preguntas 2-4 se deciden en sprint 1 con el feedback. Si quieres respuestas ya, dímelo y las fijo en este PRD.
