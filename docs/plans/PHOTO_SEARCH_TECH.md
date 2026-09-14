# Tech plan: Encuentra tus fotos · mi-dorsal

> **Estado:** borrador — 12 sep 2026.
> **Stack confirmado:** Next.js 15 (App Router) + Convex + Clerk + Modal serverless (Python).
> **Reutiliza:** `find-my-race/src/findmyrace/` (insightface, easyocr, pipeline, matcher).
> **Ref. funcional:** `docs/plans/PHOTO_SEARCH_PRD.md`. **Ref. operativa:** `docs/plans/PHOTO_SEARCH_OPS.md`.

---

## 1. Vista de pájaro (arquitectura)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Vercel)                              │
│                                                                         │
│  /perfil/fotos/[raceSlug]   ──►  PhotoSearchForm.tsx                   │
│                                       │                                │
│                                       ▼                                │
│                              Convex mutation                            │
│                              photoSearch.create                         │
│                                       │                                │
│                                       ▼                                │
│  /perfil/fotos/[raceSlug]/job/[jobId] ◄──polling cada 3s──►            │
│  PhotoSearchProgress.tsx                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Convex)                                  │
│                                                                         │
│  photoSearch.ts                                                         │
│    ├─ create(userId, raceId, selfieStorageIds[], dorsal)                │
│    │    └─ Valida Pro, crea job, sube selfies a Convex File Storage     │
│    ├─ getJob(jobId)                                                     │
│    │    └─ Snapshot para polling                                        │
│    ├─ getResults(jobId)                                                 │
│    │    └─ Lista de fotos encontradas con thumbnails                    │
│    └─ listMine(userId)                                                  │
│         └─ Histórico de búsquedas del usuario                           │
│                                                                         │
│  photoSearchActions.ts                                                  │
│    └─ runJob(jobId)                                                     │
│         └─ Scheduled action que llama a Modal                           │
│                                                                         │
│  crons/cleanupPhotoSearch.ts (diario 03:00 UTC)                         │
│    └─ Borra selfies y jobs >24h done                                     │
│                                                                         │
│  emails/templates/photosFound.ts                                        │
│    └─ Nuevo email con thumbnails inline                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     BACKEND ML (Modal serverless)                       │
│                                                                         │
│  Endpoint: POST https://mi-dorsal-prod.modal.run/find-photos            │
│                                                                         │
│  Body: {                                                                 │
│    jobId: "ps_abc123",                                                  │
│    selfieUrls: ["https://convex..."],  // temporales                     │
│    albumUrl: "https://flickr.com/...",                                  │
│    dorsal: "429",              // opcional                              │
│    raceName: "...",                                                      │
│    userId: "...",                                                       │
│  }                                                                      │
│                                                                         │
│  Pipeline (reusa findmyrace):                                           │
│    1. Descarga selfies → InsightFace.detect → embeddings                │
│    2. Descarga álbum ZIP o itera fotos                                  │
│    3. Por cada foto del álbum:                                          │
│       ├─ InsightFace.detect → embedding                                 │
│       ├─ Comparar con embedding de referencia (cosine sim)              │
│       ├─ Si sim < 0.30 → descartar                                      │
│       ├─ EasyOCR en bounding box de cara → buscar dorsal                │
│       ├─ (opcional) Color match                                         │
│       └─ Score final: 0.6 cara + 0.25 dorsal + 0.15 color              │
│    4. Top-K=15 + URLs públicas                                          │
│                                                                         │
│  Response:                                                              │
│    {                                                                    │
│      jobId: "ps_abc123",                                                │
│      status: "done",                                                    │
│      results: [                                                         │
│        {                                                                │
│          url: "https://flickr.com/photos/12345/...",                    │
│          thumbnailUrl: "...",                                            │
│          score: 0.94,                                                   │
│          faceScore: 0.97,                                               │
│          dorsalMatch: "429",                                            │
│          bbox: {x: 100, y: 200, w: 80, h: 80},                          │
│        },                                                               │
│        ...                                                              │
│      ],                                                                 │
│      stats: {                                                           │
│        photosScanned: 2847,                                             │
│        photosMatched: 4,                                                 │
│        durationMs: 67000,                                               │
│      },                                                                 │
│    }                                                                    │
│                                                                         │
│  Cleanup: tras response, borrar TODAS las selfies y embeddings          │
│           de la memoria del container. Selfies originales se             │
│           borran en Convex con el cron diario.                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Schema Convex (nuevas tablas)

```ts
// En convex/schema.ts, añadir al final:

photoSearchJobs: defineTable({
  userId: v.id("profiles"),
  raceId: v.id("races"),
  dorsal: v.optional(v.string()),

  // Selfies subidas (referencias a Convex File Storage, temporales)
  selfieStorageIds: v.array(v.id("_storage")),
  selfieCount: v.number(),

  // Estado del job
  status: v.union(
    v.literal("pending"),      // creado, esperando a Modal
    v.literal("running"),      // Modal procesando
    v.literal("done"),         // completado con éxito
    v.literal("error"),        // falló
    v.literal("no_results"),   // completado pero 0 matches
    v.literal("cancelled"),    // usuario canceló
  ),
  progress: v.object({
    phase: v.union(
      v.literal("uploading"),     // subiendo selfies
      v.literal("detecting"),     // detectando cara
      v.literal("scanning"),      // escaneando álbum
      v.literal("filtering"),     // filtrando por dorsal
    ),
    photosScanned: v.number(),
    photosTotal: v.optional(v.number()),
    matchedSoFar: v.number(),
  }),

  // Resultados (rellenados al terminar)
  results: v.array(v.object({
    photoUrl: v.string(),         // URL pública original
    thumbnailUrl: v.string(),    // thumbnail optimizado
    score: v.number(),           // 0-1, score combinado
    faceScore: v.number(),
    dorsalMatch: v.optional(v.string()),
    bbox: v.object({
      x: v.number(),
      y: v.number(),
      w: v.number(),
      h: v.number(),
    }),
  })),

  // Métricas del job
  stats: v.optional(v.object({
    photosScanned: v.number(),
    photosTotal: v.number(),
    durationMs: v.number(),
    gpuType: v.string(),         // ej: "A10G"
    gpuCostUsd: v.optional(v.number()),
  })),

  // Source de álbum usado
  albumSource: v.union(
    v.literal("flickr_url"),
    v.literal("organizer_upload"),
    v.literal("external_url"),
  ),
  albumUrl: v.string(),

  error: v.optional(v.string()),

  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  expiresAt: v.number(),         // createdAt + 24h (RGPD)
})
  .index("by_user", ["userId"])
  .index("by_race", ["raceId"])
  .index("by_user_race", ["userId", "raceId"])
  .index("by_status", ["status"])
  .index("by_expires_at", ["expiresAt"]),  // para cleanup
```

**Decisiones de schema:**
- `expiresAt` es un campo denormalizado para que el cron de cleanup use índice, no filter.
- `results` se guardan inline (no tabla aparte) porque son read-only tras el job y siempre se leen juntos. Límite duro: 15 resultados × ~500 bytes = ~7.5 KB por job, muy por debajo del límite de Convex (1 MB/doc).
- `bbox` (bounding box) se guarda para futuro overlay en UI ("aquí saliste tú").
- `albumSource` discrimina el método de descarga para reproducir en debugging.

## 3. Mutations y queries (`convex/photoSearch.ts`)

> **Nota (13 sep 2026):** el pseudocódigo de abajo usa `requireUser`/`getOptionalUser`
> (de `convex/_helpers.ts`) y `api.subscriptions.getMyPremiumStatus`, que son los
> helpers reales que ya usa el resto del proyecto (ver `convex/stickerEditor.ts`,
> `convex/subscriptions.ts`). Las versiones anteriores de este doc usaban
> `getAuthUserId`/`internal.subscriptions.isActivePro`, que **no existen** en el
> código — quedó corregido tras auditar el codebase real. `dorsalNumber` (no
> `dorsal`) es el nombre del campo en `myRaces`.

```ts
// === MUTATIONS ===

// 1. Crear job (Pro-gated, valida dorsal inscrito)
export const create = mutation({
  args: {
    raceId: v.id("races"),
    dorsal: v.optional(v.string()),
    selfieStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx); // convex/_helpers.ts — throws si no hay sesión
    const userId = profile._id;

    // Gate Pro (mismo check que ya usa el resto del proyecto; bypassa
    // admin/test automáticamente, ver convex/subscriptions.ts)
    const premiumStatus = await ctx.runQuery(api.subscriptions.getMyPremiumStatus, {});
    if (!premiumStatus.hasAccess) throw new Error("Requiere suscripción Pro");

    // Validar dorsal inscrito (si el usuario está en myRaces con dorsal)
    const myRace = await ctx.db
      .query("myRaces")
      .withIndex("by_user_race", (q) =>
        q.eq("userId", userId).eq("raceId", args.raceId)
      )
      .first();
    // dorsal es opcional, pero si está y difiere del inscrito, warn (no block)

    // Rate limit: 20/día por usuario
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentJobs = await ctx.db
      .query("photoSearchJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("createdAt"), oneDayAgo))
      .collect();
    if (recentJobs.length >= 20) {
      throw new Error("Has alcanzado el límite diario de búsquedas (20)");
    }

    // Validar selfies count
    if (args.selfieStorageIds.length === 0 || args.selfieStorageIds.length > 3) {
      throw new Error("Sube entre 1 y 3 selfies");
    }

    // Validar race tiene photosUrl
    const race = await ctx.db.get(args.raceId);
    if (!race?.photosUrl) {
      throw new Error("Esta carrera aún no tiene álbum de fotos");
    }

    // Determinar source del álbum. NOTA (13 sep 2026, tras probar
    // find-my-race/src/findmyrace/sources/flickr.py contra álbumes reales):
    // "flickr_url" es la única fuente con downloader fiable hoy (API REST
    // oficial de Flickr vía site_key público — ver PHOTO_SEARCH_TECH.md §13).
    // "organizer_upload"/"external_url" NO tienen downloader implementado;
    // si albumSource no es "flickr_url", el job debe fallar rápido con un
    // error claro en vez de intentar un scraping genérico que no existe.
    const albumSource = race.photosUrl.includes("flickr.com")
      ? "flickr_url"
      : race.photosUrl.includes("mi-dorsal.com")
        ? "organizer_upload"
        : "external_url";
    if (albumSource !== "flickr_url") {
      throw new Error(
        "Esta carrera usa un proveedor de fotos que aún no soportamos automáticamente."
      );
    }

    // Crear job
    const jobId = await ctx.db.insert("photoSearchJobs", {
      userId,
      raceId: args.raceId,
      dorsal: args.dorsal ?? myRace?.dorsalNumber,
      selfieStorageIds: args.selfieStorageIds,
      selfieCount: args.selfieStorageIds.length,
      status: "pending",
      progress: {
        phase: "uploading",
        photosScanned: 0,
        matchedSoFar: 0,
      },
      results: [],
      albumSource,
      albumUrl: race.photosUrl,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    });

    // Disparar scheduled action
    await ctx.scheduler.runAfter(0, internal.photoSearchActions.runJob, { jobId });

    return jobId;
  },
});

// 2. Cancelar job (solo si pending/running)
export const cancel = mutation({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const profile = await requireUser(ctx);

    const job = await ctx.db.get(jobId);
    assertOwner(job, profile._id, "Búsqueda de fotos"); // convex/_helpers.ts

    if (job.status === "done" || job.status === "no_results") return;

    await ctx.db.patch(jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    // Borrar selfies inmediatamente
    for (const storageId of job.selfieStorageIds) {
      await ctx.storage.delete(storageId);
    }
  },
});

// === QUERIES ===

// Snapshot del job (para polling)
export const getJob = query({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const profile = await requireUser(ctx);

    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (job.userId !== profile._id) throw new Error("No autorizado");

    return {
      _id: job._id,
      status: job.status,
      progress: job.progress,
      stats: job.stats,
      error: job.error,
      hasResults: job.results.length > 0,
      resultCount: job.results.length,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  },
});

// Resultados completos (carga solo cuando status=done)
export const getResults = query({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const profile = await requireUser(ctx);

    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (job.userId !== profile._id) throw new Error("No autorizado");

    return {
      _id: job._id,
      raceId: job.raceId,
      dorsal: job.dorsal,
      status: job.status,
      results: job.results,
      stats: job.stats,
      completedAt: job.completedAt,
    };
  },
});

// Histórico del usuario (para /perfil/fotos)
export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const profile = await getOptionalUser(ctx); // no autenticado -> []
    if (!profile) return [];

    return await ctx.db
      .query("photoSearchJobs")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .order("desc")
      .take(limit);
  },
});
```

## 4. Scheduled action (`convex/photoSearchActions.ts`)

```ts
import { internalAction, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

const MODAL_ENDPOINT = process.env.MODAL_PHOTO_SEARCH_URL!;
const MODAL_API_KEY = process.env.MODAL_API_KEY!;

export const runJob = internalAction({
  args: { jobId: v.id("photoSearchJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.photoSearch.getJobInternal, { jobId });
    if (!job || job.status === "cancelled") return;

    // Marcar como running
    await ctx.runMutation(internal.photoSearchActions.markRunning, {
      jobId,
      phase: "detecting",
    });

    try {
      // Obtener URLs públicas temporales de las selfies (válidas 1h)
      const selfieUrls = await Promise.all(
        job.selfieStorageIds.map(async (storageId) => {
          return await ctx.storage.getUrl(storageId);
        })
      );

      // Llamar a Modal
      const response = await fetch(MODAL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MODAL_API_KEY}`,
        },
        body: JSON.stringify({
          jobId,
          selfieUrls,
          albumUrl: job.albumUrl,
          dorsal: job.dorsal,
          raceName: job.raceName,
          userId: job.userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Modal returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Guardar resultados
      await ctx.runMutation(internal.photoSearchActions.markDone, {
        jobId,
        results: result.results,
        stats: result.stats,
      });

      // Enviar email si hay resultados.
      //
      // NOTA (13 sep 2026, corregido tras auditar convex/emailDispatch.ts):
      // - `dispatchAndLog` exige `myRaceId: v.id("myRaces")` (NO opcional).
      //   Un job de foto-search puede no tener una myRace 1:1 limpia (el
      //   usuario pudo buscar sin dorsal inscrito, ver PRD §10 pregunta 4).
      //   Hay que decidir esto ANTES de implementar: o (a) se resuelve la
      //   myRace por (userId, raceId) y si no existe no se envía email
      //   (el usuario ve el resultado solo en la UI), o (b) se relaja
      //   `dispatchAndLog` para aceptar `myRaceId` opcional — cambio a
      //   `convex/emailDispatch.ts` y su tabla `notificationLog`, no solo
      //   a este action.
      // - El type `"photos_found"` NO existe en la unión de
      //   `notificationLog`/`dispatchAndLog` (solo existe `"photos_available"`,
      //   que es el aviso genérico de "ya hay álbum", no el de "te
      //   encontramos"). Hay que añadir `v.literal("photos_found")` en los
      //   mismos 3 sitios que se tocaron para `photos_available`
      //   (`convex/schema.ts`, `convex/emailNotificationsHelpers.ts` →
      //   `hasLogForMyRace`/`writeLog` — ver el spec de esa feature).
      // - `job.raceName` y `userEmail` no existen tal cual: hay que resolver
      //   `race.name` (via `ctx.db.get(job.raceId)`) y el email del usuario
      //   (via `ctx.db.get(job.userId)` → `profile.email` o equivalente)
      //   antes de llamar a dispatchAndLog.
      if (result.results.length > 0) {
        // Pseudocódigo — ninguna de estas 3 internalQuery existe todavía,
        // habría que crearlas (o localizar equivalentes ya existentes:
        // p. ej. `getMyProfile`/`getProfileByClerkId` en convex/users.ts
        // toman `identity`/`clerkUserId`, no `userId`, así que no sirven
        // tal cual desde una internalAction sin identity — necesitan una
        // versión internal por profileId/userId):
        const myRace = await ctx.runQuery(internal.photoSearch.getMyRaceForJobInternal, {
          userId: job.userId,
          raceId: job.raceId,
        });
        if (myRace) {
          const [profile, race] = await Promise.all([
            ctx.runQuery(internal.users.getProfileByIdInternal, { userId: job.userId }),
            ctx.runQuery(internal.races.getRaceByIdInternal, { raceId: job.raceId }),
          ]);
          await ctx.runAction(internal.emailDispatch.dispatchAndLog, {
            to: profile.email,
            ...photosFoundEmail({ raceName: race.name, results: result.results }),
            type: "photos_found", // requiere añadir el literal (ver nota arriba)
            userId: job.userId,
            myRaceId: myRace._id,
          });
        }
        // Si no hay myRace, el usuario ve el resultado solo en /perfil/fotos
        // (no bloqueante, pero decidir si esto es aceptable para el MVP).
      }
    } catch (err) {
      await ctx.runMutation(internal.photoSearchActions.markError, {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

export const markRunning = internalMutation({...});
export const markDone = internalMutation({...});
export const markError = internalMutation({...});
```

## 5. Cron de limpieza (`convex/crons/cleanupPhotoSearch.ts`)

```ts
import { cronJobs } from "../cronJobs";
import { internal } from "../_generated/api";

// Diario a las 03:00 UTC
cronJobs.interval(
  "cleanup photo search jobs",
  { hours: 24 },
  internal.photoSearchActions.cleanupOldJobs,
);
```

```ts
// En photoSearchActions.ts:
export const cleanupOldJobs = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredJobs = await ctx.runQuery(
      internal.photoSearch.getExpiredJobs,
      { now }
    );

    let deleted = 0;
    for (const job of expiredJobs) {
      // Borrar selfies de Convex File Storage
      for (const storageId of job.selfieStorageIds) {
        await ctx.storage.delete(storageId);
      }
      // Borrar job
      await ctx.runMutation(internal.photoSearch.deleteJobInternal, {
        jobId: job._id,
      });
      deleted++;
    }

    console.log(`[photo-search cleanup] Deleted ${deleted} jobs`);
  },
});
```

**Nota de seguridad**: el cron borra ANTES de que el usuario pueda acceder al job expirado. Si el usuario llega a `/perfil/fotos/[jobId]` y el job está borrado, la query devuelve `null` con mensaje "Esta búsqueda ya no está disponible (los datos se borran tras 24h por privacidad)".

## 6. Modal endpoint (Python)

### 6.1. Estructura del proyecto Modal

```
modal-photo-search/
├── modal_app.py           # Entry point con @stub.function()
├── modal_requirements.txt
├── findmyrace/            # Git submodule o copy de find-my-race/src/findmyrace/
│   ├── face.py
│   ├── ocr.py
│   ├── matcher.py
│   ├── pipeline.py
│   ├── sources/
│   └── config.py
└── README.md
```

### 6.2. `modal_app.py` (esqueleto)

> **Actualizado (14 sep 2026)** tras el trabajo real de validación/fix en
> `find-my-race` — este pseudocódigo ya refleja la API real del paquete
> (antes citaba `findmyrace.download.download_album_zip`, que **ya no
> existe**: se retiró al sustituirlo por `findmyrace.sources`, ver §15
> para el detalle completo de qué cambió y por qué). Puntos clave:
> - La descarga usa `sources.get_source_for_url(url).download(...)`, no
>   un downloader específico de Flickr a mano.
> - `FaceRecognizer.assess_reference()` valida cada selfie ANTES de
>   `add_reference()` — rechazar en Modal una selfie mala es tirar GPU;
>   mejor rechazarla en Convex antes de crear el job (ver §15.3).
> - `pipeline.run()` ya no necesita `min_score` para no perder identidades
>   confirmadas — `include_identity_matches=True` es el default.

```python
import modal
import os
import tempfile
import httpx
from pathlib import Path

# Stub con imagen que preinstala todo (cache en Modal)
stub = modal.Stub(
    "mi-dorsal-photo-search",
    image=modal.Image.debian_slim()
    .pip_install_from_requirements("modal_requirements.txt")
    .apt_install(["libgl1", "libglib2.0-0"])  # OpenCV deps
    .run_commands([
        # Pre-descargar modelos InsightFace y EasyOCR para evitar cold-start
        "python -c 'from insightface.app import FaceAnalysis; app = FaceAnalysis(name=\"buffalo_l\"); app.prepare(ctx_id=-1)'",
        "python -c 'import easyocr; reader = easyocr.Reader([\"en\", \"es\"], gpu=False)'",
    ]),
)

@stub.function(
    gpu="A10G",           # ~$0.0005/seg
    memory=8192,          # 8 GB
    timeout=300,          # 5 min max por job
    secrets=[modal.Secret.from_name("photo-search-auth")],
)
@modal.web_endpoint(method="POST")
async def find_photos(jobId: str, selfieUrls: list[str], albumUrl: str,
                     dorsal: str = "", raceName: str = "", userId: str = ""):
    # Verificar auth
    expected_key = os.environ["MODAL_API_KEY"]
    # (Modal maneja auth via API token, este check es opcional)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # 1. Descargar selfies
        selfie_paths = []
        for i, url in enumerate(selfieUrls):
            path = tmpdir / f"selfie_{i}.jpg"
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                path.write_bytes(response.content)
            selfie_paths.append(path)

        # 2. Construir FaceRecognizer con cache de embeddings.
        #
        # NOTA: la validación de calidad de cada selfie (assess_reference)
        # NO debería vivir aquí — para entonces la GPU de Modal ya está
        # facturando. Debe pasar en Convex, en la mutation `create`, ANTES
        # de disparar este endpoint (ver §15.3). Aquí solo queda el caso
        # límite de que las 1-3 selfies fallen TODAS por algún motivo
        # imprevisto (p. ej. la URL firmada de Convex Storage expiró).
        from findmyrace.face import FaceRecognizer
        from findmyrace.pipeline import Pipeline
        from findmyrace.ocr import DorsalDetector
        from findmyrace.color import ColorMatcher

        face = FaceRecognizer(cache_dir=tmpdir / "cache")
        for selfie in selfie_paths:
            face.add_reference(selfie)

        if face.num_references == 0:
            return {"jobId": jobId, "status": "error",
                    "error": "No se detectó cara en ninguna selfie"}

        # 3. Construir pipeline
        pipeline = Pipeline(
            dorsal_detector=DorsalDetector(languages=["en", "es"], gpu=False),
            color_matcher=ColorMatcher(bins=32),
            face_recognizer=face,
        )

        # 4. Descargar álbum. Solo Flickr tiene downloader real hoy — ver
        # §15.1. get_source_for_url lanza ValueError si la URL no es de
        # ningún origen soportado; ese caso debe filtrarse ANTES de crear
        # el job en Convex (§3), no descubrirse aquí.
        from findmyrace.sources import get_source_for_url
        album_dir = tmpdir / "album" / "photos"
        source = get_source_for_url(albumUrl)
        downloaded = source.download(albumUrl, album_dir)
        if not downloaded:
            return {"jobId": jobId, "status": "error",
                    "error": "No se pudo descargar el álbum"}

        # 5. Procesar. progress_callback puede usarse para hacer POST a
        # una mutation interna de Convex y así alimentar el polling de
        # /perfil/fotos/[raceSlug]/job/[jobId] — no implementado en este
        # esqueleto, ver TECH.md §4 (progress.photosScanned).
        photo_scores = pipeline.run(
            album=album_dir,
            target_dorsal=dorsal,
            min_score=0.30,
            top_k=15,
            # include_identity_matches=True es el default — una foto con
            # identidad confirmada (gate de cara superado) no se pierde
            # aunque el dorsal no se detecte en ella. Ver §15.2.
        )

        # 6. Formatear resultados
        results = []
        for ps in photo_scores:
            results.append({
                "photoUrl": f"{albumUrl.rstrip('/')}/{ps.path.name}",
                "thumbnailUrl": ...,  # generar thumbnail on-the-fly
                "score": round(ps.score, 3),
                "identityConfirmed": ps.identity_confirmed,
                "faceScore": round(ps.face.score, 3) if ps.face else 0,
                "dorsalMatch": ps.dorsal.text if ps.dorsal else None,
                "bbox": {
                    "x": ps.face.bbox[0] if ps.face else 0,
                    "y": ps.face.bbox[1] if ps.face else 0,
                    "w": ps.face.bbox[2] - ps.face.bbox[0] if ps.face else 0,
                    "h": ps.face.bbox[3] - ps.face.bbox[1] if ps.face else 0,
                },
            })

        return {
            "jobId": jobId,
            "status": "done",
            "results": results,
            "stats": {
                "photosScanned": len(downloaded),
                "photosTotal": len(downloaded),
                "durationMs": ...,
                "gpuType": "A10G",
            },
        }

        # tmpdir se borra automáticamente aquí (selfies originales)
```

### 6.3. Variables de entorno (Modal Secret)

```
MODAL_API_KEY=<random-32-chars>
```

El secret se inyecta al endpoint y se compara con el header `Authorization` que manda Convex. Simple shared-secret (no JWT, no OAuth — son servicios internos).

## 7. Email template (`convex/emails/templates/photosFound.ts`)

Reutilizar estructura de `photosAvailable.ts` (mismas `COLORS`, mismo footer, mismo brand header) pero con:
- Hero: "📸 N fotos te han encontrado"
- Body: "Hemos encontrado tus fotos en [Carrera]. Te las adjuntamos aquí."
- Grid de 4 thumbnails inline (base64 o URLs signed)
- CTA primario: "Ver todas y descargar" → `/perfil/fotos/[raceSlug]/job/[jobId]`
- CTA secundario: "Guardar en mi perfil"
- Disclaimer RGPD: "Las fotos se han generado con IA a partir de tu selfie. Esta búsqueda se borrará automáticamente en 24h."

## 8. Variables de entorno (nuevas)

### Vercel
```
NEXT_PUBLIC_PHOTO_SEARCH_ENABLED=true   # feature flag global
MODAL_PHOTO_SEARCH_URL=https://mi-dorsal-prod.modal.run/find-photos
MODAL_API_KEY=<same-as-modal-secret>
```

### Convex
```
# (en dashboard Convex, no .env.local)
MODAL_PHOTO_SEARCH_URL=...
MODAL_API_KEY=...
```

### Modal Secret
```
MODAL_API_KEY=<random-32-chars>  # mismo valor que en Vercel/Convex
```

## 9. Feature flag + kill switch

Por si algo sale mal en producción, kill switch en `convex/photoSearch.ts`:

```ts
const isEnabled = process.env.NEXT_PUBLIC_PHOTO_SEARCH_ENABLED === "true";
if (!isEnabled) throw new Error("Feature temporalmente desactivada");
```

Apagas desde el dashboard de Vercel (cambiar env var) en <30 segundos sin redeploy.

## 10. Monitoring y observabilidad

### Logs estructurados

Cada job loguea a `console.log` con prefijo `[photo-search]`:
- `[photo-search] job ps_abc created by user_X for race_Y`
- `[photo-search] Modal started for ps_abc (A10G, ETA 60s)`
- `[photo-search] Modal done for ps_abc: 4 results in 67s, cost $0.034`

### Métricas clave (Convex aggregates o PostHog)

- `photo_search_created` (counter)
- `photo_search_completed` (counter, con status)
- `photo_search_duration_ms` (histogram)
- `photo_search_results_count` (histogram, 0-15)
- `photo_search_gpu_cost_usd` (counter)

### Alertas (sencillas, sin PagerDuty)

- Tasa de error >20% en jobs de la última hora → email a Manu
- Coste GPU diario >5€ → email a Manu
- Job >5min sin completar → email a Manu (puede ser hung en Modal)

## 11. Decisiones técnicas que dejo abiertas

1. **¿Streaming SSE vs polling cada 3s?** — Polling es más simple y Convex lo soporta nativamente. Empezar con polling, migrar a SSE si la latencia de UI molesta.
2. **¿Thumbnails inline en email o solo links?** — Inline = mejor engagement, peor deliverability (Gmail recorta). Empezar con links, A/B test en beta.
3. **¿Guardar bbox en Convex o solo en Modal response?** — Guardar en Convex abre puerta a futuro "overlay UI" pero ocupa espacio. Empezar con bbox mínimo (x, y, w, h).
4. **¿Cachear embeddings de selfies en Modal?** — No (RGPD, mínimo privilegio). Cada job recalcula desde cero. ~2s extra, asumible.

---

## 12. Plan de implementación por sprints (6-8 semanas)

### Sprint 0 (sem 1): Backend Modal — ✅ completado 14 sep 2026
- [x] Crear `photo-search-api/` (no `modal-photo-search/` separado — mismo
      repo mi-dorsal, ver §15)
- [x] Reutilizar `findmyrace/` (face.py, ocr.py, matcher.py, pipeline.py)
      sin cambios de lógica — solo config de storage/HOME para Modal
- [x] `modal_app.py` con endpoint `POST /api/find_photos` (FastAPI, no una
      ruta `/find-photos` a medida — reutiliza `api/find_photos.py`)
- [x] Test con selfie real + álbum Canfranc-Canfranc/mikemanitasdpm (ver §15.7)
- [x] Verificado cold-start (Vercel probado y descartado por esto),
      warm-up y timeout — Modal con volumen persistente, 600s de timeout

### Sprint 1 (sem 2): Convex bridge — ✅ completado 14 sep 2026
- [x] Tabla `photoSearchJobs` en `schema.ts` (forma real, no la del
      pseudocódigo — ver §16)
- [x] `convex/photoSearch.ts`: create, cancel, getJob, getResults,
      listMine, generateSelfieUploadUrl
- [x] `convex/photoSearchActions.ts`: runJob (action que llama a Modal)
- [x] `convex/crons/cleanupPhotoSearch.ts`
- [x] Prueba end-to-end real (CLI de Convex con `--identity`, selfie real
      subida a Storage, álbum real de Flickr) — ver §16

### Sprint 2 (sem 3): UI básica
- [ ] `/perfil/fotos` (listado de carreras con `photosUrl`)
- [ ] `/perfil/fotos/[raceSlug]` (formulario de subida)
- [ ] `PhotoSearchForm.tsx` (drag-and-drop + dorsal + validación)
- [ ] `/perfil/fotos/[raceSlug]/job/[jobId]` (polling status)
- [ ] `PhotoSearchProgress.tsx` (barra con fases)

### Sprint 3 (sem 4): Resultados + email
- [ ] `PhotoSearchResults.tsx` (grid + scores)
- [ ] `convex/emails/templates/photosFound.ts`
- [ ] Disparar email al completar job
- [ ] Empty states ("0 fotos, posibles razones")

### Sprint 4 (sem 5): Paywall + Pro gate
- [ ] Envolver UI en `<Paywall>` con copy específico
- [ ] Rate limit (20/día) funcional
- [ ] Página `/pro` actualizada con sección nueva
- [ ] Manejo de errores de Modal (álbum no descargable, etc.)

### Sprint 5 (sem 6): Polish + edge cases
- [ ] Loading states pulidos
- [ ] Tooltips RGPD (selfie se borra, etc.)
- [ ] Página `/admin/photo-search` con métricas
- [ ] Manejo de dorsal no inscrito (warn, no block)

### Sprint 6 (sem 7-8): Beta cerrada
- [ ] Activar solo para ti + 5-10 Bull Runners
- [ ] Recoger feedback cualitativo
- [ ] A/B test de copy en emails
- [ ] Decidir rollout público basado en métricas

---

## 13. Refactor de `find-my-race` (opcional, no bloqueante)

`find-my-race` puede quedar como proyecto hermano (herramienta personal) mientras `modal-photo-search` consume su lógica. Si el feature tiene éxito, en Y2 fusionarlos:

- Mover `findmyrace/` a un paquete interno compartido
- Convertir `find-my-race` en SaaS B2C (suscripción independiente para corredores que no están en mi-dorsal)
- O donar `find-my-race` a la comunidad (open-source)

Por ahora: **copy + submodule, no fusión**. El coste de mantener dos copias es despreciable frente al coste de acoplar dos proyectos con audiencias distintas.

## 14. Hallazgos de validación en `find-my-race` (12-13 sep 2026)

> Sesión de trabajo directo en `C:\desarrollo\find-my-race` arreglando y probando
> el pipeline real contra álbumes de Flickr reales. Esto reemplaza las
> suposiciones de las secciones anteriores sobre "descargar el álbum" — que
> resultó ser el punto más frágil del plan original, no un detalle trivial.

### 14.1. Bug de reconocimiento facial corregido

`src/findmyrace/face.py::FaceRecognizer.add_reference` promediaba **todas**
las caras detectadas en una foto de referencia, incluyendo desconocidos de
fondo si la foto de referencia no era un selfie limpio (p. ej. una foto de
carrera con gente detrás). Esto contamina el embedding y rompe el matching
por completo (0 resultados donde debería haber matches). Corregido: ahora
se usa solo la cara de mayor bbox (asumida como la persona en primer plano).
**Implicación para el MVP**: la UI debe seguir pidiendo selfies limpios (como
ya dice el PRD §6.1: "máx 3 selfies"), pero si un usuario sube una foto de
grupo por error, el pipeline ya no falla silenciosamente — usa la cara más
grande. Aun así, sería buena UX avisar en el frontend si la foto de
referencia tiene >1 cara detectada.

### 14.2. Descarga de álbumes de Flickr: reescrita, ya no usa Playwright

El downloader que TECH.md §1/§6 asumía (`download_album_zip`, simula clicks
en la UI de Flickr con Playwright, tarda hasta 12 min esperando el ZIP) era
frágil y quedó sustituido por la **API REST oficial de Flickr**
(`flickr.photosets.getPhotos`), autenticada con el `site_key` público que el
propio frontend de flickr.com expone en el HTML de cada álbum — no requiere
API key propia ni scraping de UI. Con esto:

- Se obtiene el álbum completo (probado con 500 fotos reales) en 1-2
  llamadas, con el total real — antes, el scraper HTML por página se
  quedaba corto en álbumes grandes (topaba en ~120 fotos de 500 reales,
  porque Flickr solo renderiza esas en HTML sin JS de scroll).
- Descarga en tamaño `_k` (2048px, de sobra para OCR/cara) en vez de `_o`
  (original), reduciendo la presión de rate-limit de Flickr.
- Se añadió retry con backoff ante 429 (confirmado: Flickr limita la tasa
  real al descargar 300+ fotos seguidas) — sin esto se pierde una fracción
  no trivial de las fotos del álbum.
- El feed Atom de Flickr (`services/feeds/photoset.gne`) que la versión
  original de `find-my-race` documentaba como alternativa **ya no respeta
  el parámetro `page`** (confirmado empíricamente: siempre devuelve la
  primera página) — no es una fuente viable en 2026.

**Implicación directa para `photoSearchActions.ts` (Modal)**: el endpoint
Python de Modal (§6.2) debe portar esta misma lógica (API REST + site_key +
retry/backoff), no el downloader viejo. Referencia de la implementación:
`find-my-race/src/findmyrace/sources/flickr.py` (`_extract_site_key_and_nsid`,
`_list_via_api`) y `find-my-race/src/findmyrace/sources/base.py`
(`_download_one` con retry). Ver §15 para el detalle completo de
integración, incluidas 2 rondas más de fixes (13-14 sep 2026) posteriores a
esta nota.

### 14.3. Sigue sin haber downloader para proveedores que no son Flickr

Confirmado en la sesión anterior (ver conversación previa, "qué proveedores
usan realmente los organizadores"): fotoscarreras.com, barrel.cloud,
QuieroMisFotos y similares **no tienen downloader implementado ni
planeado**. La mutation `create` (§3, ya corregida arriba) ahora rechaza
explícitamente cualquier `photosUrl` que no sea de Flickr, en vez de
intentar un `"external_url"` que no tiene código detrás. Esto reduce el
alcance real del feature a un subconjunto del catálogo — tamaño exacto aún
desconocido porque ninguna carrera real tiene `photosUrl` rellena todavía
(0 en la base de datos de dev a 13 sep 2026).

### 14.4. Validación de precisión — actualizada con un positivo real (13-14 sep 2026)

> **Actualización:** esta sección quedó parcialmente resuelta el 13-14 sep.
> Ver §15.4 para el detalle completo (positivo real de Manu, bug de
> threshold encontrado gracias a esa validación, y segundo fotógrafo para
> cobertura de descarga). Se deja el texto original como referencia
> histórica de por qué se dudaba del "100% recall" original.

Los "100% recall" de README.md de `find-my-race` se basaban en 2 álbumes y
6 fotos-positivas totales, todas del mismo fotógrafo (cuenta de Flickr
"Acariciando la Luz", zona Alicante) — no permitía distinguir "el pipeline
funciona en general" de "funciona con las fotos de este fotógrafo en
concreto". Antes de fijar el objetivo de "≥60% tasa de éxito" en OPS.md §4
como algo alcanzable, se necesitaba validar con un positivo real ajeno a
esas pruebas de humo — eso es justo lo que pasó en la sesión del 13 sep
(ver §15.4).

## 15. Cómo se conecta e integra `find-my-race` con mi-dorsal (13-14 sep 2026)

> Esta sección es la referencia de arquitectura de integración — reemplaza
> como fuente de verdad las notas dispersas de §14 sobre "qué cambió".
> `find-my-race` (repo hermano, `C:\desarrollo\find-my-race`) es hoy la
> **única implementación real y probada** del pipeline de reconocimiento;
> el endpoint Modal de §6 sigue siendo pseudocódigo que debe portar esta
> lógica, no reinventarla.

### 15.1. Mapa de módulos: qué usa el endpoint Modal, de dónde

```
find-my-race/src/findmyrace/
├── face.py              → FaceRecognizer: embeddings + gate de identidad
│                           + zoom en zona gris (§15.5) + assess_reference (§15.3)
├── reference_quality.py → pre-score de selfies ANTES de aceptarlas (§15.3)
├── matcher.py            → Matcher.score_photo: cara+dorsal+color -> PhotoScore
│                           FACE_GATE_THRESHOLD=0.30 (constante nombrada)
├── pipeline.py           → Pipeline.run: orquesta todo el álbum, paralelo
│                           include_identity_matches=True (default, §15.2)
├── ocr.py                → DorsalDetector (EasyOCR + fuzzy match)
├── color.py              → ColorMatcher (histograma HSV, bonus opcional)
└── sources/
    ├── base.py           → PhotoSource.download: session reuse + backoff
    │                        adaptativo (§15.6)
    ├── flickr.py         → FlickrSource: API REST + resolución de NSID
    │                        (§15.1.1) + fallback HTML
    └── direct.py         → DirectUrlSource (URL suelta o .txt, sin uso
                             previsto en mi-dorsal)
```

El endpoint Modal (§6.2) importa `face`, `pipeline`, `ocr`, `color`,
`sources` — no reimplementa nada de esto. `download.py` (Playwright,
scraping de UI) **ya no existe** en el repo — se retiró al sustituirlo por
`sources.get_source_for_url(...).download(...)`.

#### 15.1.1. Por qué la resolución de NSID importa para mi-dorsal

Un admin de mi-dorsal pegará URLs de álbum tal como las compartió el
fotógrafo — casi siempre con **pathAlias** (`flickr.com/photos/
mikemanitasdpm/albums/...`), no con el NSID numérico
(`flickr.com/photos/202749691@N08/albums/...`). Sin resolver el alias al
NSID real, `flickr.photosets.getPhotos` falla con "User not found" y el
código cae al fallback HTML — que solo trae una fracción del álbum en
casos grandes (confirmado: 73 de 297 fotos reales). `FlickrSource.
_extract_site_key_and_nsid` ya resuelve esto extrayendo `"ownerNsid":"..."`
del HTML del álbum — **es obligatorio, no opcional**, para que Modal
funcione con URLs pegadas tal cual por un admin real.

### 15.2. `identity_confirmed`: por qué el email/UI de resultados debe usarlo

`PhotoScore` (usado por `pipeline.run`) tiene un campo `identity_confirmed`
que **no existía** cuando se escribió §2/§3 de este documento. Separa dos
preguntas que antes vivían fundidas en el `score` combinado:

- **¿Es esta persona?** → gate de cara, `FACE_GATE_THRESHOLD=0.30`.
- **¿Cuán completo es el match?** → score combinado cara+dorsal+color.

Con `include_identity_matches=True` (default de `pipeline.run`), una foto
donde la cara ya confirmó la identidad se incluye en los resultados aunque
el dorsal no se haya detectado en esa foto concreta y el score combinado
sea bajo. **Implicación para el schema `photoSearchJobs.results` (§2)**:
cada resultado en Modal debe incluir `identityConfirmed: bool` (ya en el
pseudocódigo de §6.2), y la UI (`PhotoSearchResults.tsx`) debería mostrar
algo como el aviso ⚠ que ya tiene el CLI de `find-my-race`
("identidad confirmada por cara, pero sin dorsal visible en esta foto")
en vez de mezclar esos resultados sin explicación con los de score alto.

### 15.3. Pre-score de selfies: dónde debe vivir en mi-dorsal, no solo en Modal

`FaceRecognizer.assess_reference(image_path, role)` (nuevo en
`find-my-race`, 14 sep 2026) devuelve `ok` / `warn` / `reject` con motivo,
analizando 4 señales gratis (sin modelos nuevos): confianza de detección,
tamaño relativo de la cara, ángulo (yaw, vía los 5 keypoints), nitidez.

**Validado empíricamente y es el hallazgo más importante de toda esta
ronda de trabajo**: sustituir 4 referencias "de carrera" (pequeñas, con
gente detrás) por selfies limpios subió el score de las mismas fotos
objetivo de 0.29-0.35 a 0.57-0.59 — **casi el doble**, muy por encima de
cualquier ajuste de modelo probado (subir `det_size` global dio +0.03 al
doble de coste). La calidad de la selfie de referencia es, con mucho, la
palanca más barata y más rentable para la tasa de éxito del feature.

**Decisión de UX (ya tomada, pendiente de implementar en el formulario de
mi-dorsal)**: pedir **mínimo 2 fotos — una frontal y una lateral** — con
roles declarados explícitamente en la UI (dos campos de subida separados,
no un solo `<input multiple>` genérico). Esto es necesario porque
`assess_reference` solo aplica el rechazo por ángulo cuando `role=
"frontal"` — un rol `"lateral"` debe aceptar un perfil marcado (yaw
≈±0.97 medido en selfies reales) sin penalizarlo, porque es justo lo que
se está pidiendo en ese campo.

**Dónde debe correr esta validación — decisión de arquitectura pendiente**:

| Opción | Pros | Contras |
|---|---|---|
| **En Convex, antes de crear el job** (recomendado) | Rechaza selfies malas sin gastar GPU de Modal; feedback instantáneo al usuario en el formulario | Requiere correr InsightFace en Convex (¿action con el modelo cacheado?) o un endpoint ligero aparte |
| **En Modal, dentro del mismo job** | Reutiliza el modelo ya cargado ahí, cero infra nueva | Ya se gastó la invocación de Modal (aunque sea barata) antes de poder decir "tu foto no vale" |

El pseudocódigo de §6.2 ya deja una nota de que esta validación **no
debería vivir en Modal** por el motivo de coste — pero la decisión final
(¿Convex Action con modelo propio, o un endpoint Modal síncrono y barato
solo para pre-check?) no está tomada. Bloqueante antes de Sprint 2 (UI).

### 15.4. Validación con un positivo real — el hallazgo que destapó el bug de threshold

El 13 sep, Manu aportó la URL de un álbum real donde él mismo sale
(`flickr.com/photos/mikemanitasdpm/albums/72177720333843436/`, "Memorial
JM Zambrana", dorsal 1282) con 3 fotos ya identificadas a mano. Esto
reveló, en orden:

1. **El álbum listaba 73 fotos de 297 reales** — la resolución de NSID de
   §15.1.1 no existía todavía; se arregló ahí mismo.
2. **De las 3 fotos reales, el pipeline solo encontraba 1** — investigar
   por qué destapó que `Matcher.score_photo` llamaba a
   `FaceRecognizer.find_in()` sin pasar `threshold` explícito, heredando
   el default de `find_in` (0.35) en vez del `FACE_GATE_THRESHOLD`
   documentado (0.30) — **el umbral real efectivo en todas las búsquedas
   hechas hasta entonces era 0.35, no 0.30**. Arreglado pasando el
   threshold explícitamente.
3. Con el fix de threshold, una de las 2 fotos perdidas sí pasaba el gate
   (cara=0.317) pero seguía sin aparecer en el resultado — el score
   combinado (sin dorsal detectado en esa foto) caía a 0.19, por debajo
   del `min_score` de salida. Esto llevó al fix de `identity_confirmed`
   (§15.2).
4. Sustituir las 4 fotos de referencia (de carrera, pequeñas) por 6
   selfies limpios que Manu aportó subió el score de las 3 fotos reales de
   0.29-0.35 a 0.57-0.59 (§15.3) — con esto, las 3 fotos habrían aparecido
   sin necesitar siquiera el fix de `identity_confirmed`.

**Segundo fotógrafo para validar cobertura de descarga (no de matching)**:
cuenta `dietadeporte` (A Coruña, 150 álbumes de carreras populares
gallegas, formato de `photoset_id` más antiguo `72157...` en vez de
`72177720...`). Se descargaron 2 álbumes completos (132 y 502 fotos) con
**100% de cobertura** — confirma que el downloader generaliza a otro
fotógrafo/formato de ID, no es un caso particular del primero.

### 15.5. Zoom en zona gris: mejora de precisión sin coste añadido relevante

`FaceRecognizer.find_in()` acepta `gray_zone=(0.20, 0.35)` (default): si el
mejor score de la pasada normal cae en ese rango ambiguo, se hace una
segunda pasada — recortar la región de la cara con padding y re-detectar
solo en ese recorte pequeño — y se usa el mejor de los dos scores (nunca
empeora). **Medido en el álbum real de Manu (250 fotos): se activó en 1
foto (0.4%)** — el coste extra es indistinguible del ruido de medición
sobre el total. Alternativa descartada por coste: subir `det_size` global
de 640 a 1280 dio una mejora similar (+0.03) pero **al doble de coste en
TODAS las fotos**, no solo en las ambiguas (900ms/foto vs 440ms).

**Implicación para Modal**: el endpoint debe usar `find_in` con el
`gray_zone` por defecto (ya lo hace, es transparente para el caller) — no
hace falta ningún parámetro nuevo en el payload de mi-dorsal→Modal.

### 15.6. Rate-limiting de Flickr: mitigación aplicada y límites reales

Confirmado con pruebas reales: Flickr **no documenta públicamente** ningún
límite para `live.staticflickr.com` (el CDN de imágenes, donde ocurren los
429), a diferencia de la API REST (`api.flickr.com/services/rest`, límite
documentado de **3.600 llamadas/hora por API key** — irrelevante para
nuestro uso, 1-2 llamadas por álbum). La mitigación es empírica, no basada
en un límite conocido de antemano:

- **Reutilización de sesión HTTP** (`PhotoSource._get_session()`): antes
  se abría una conexión TCP/TLS nueva por cada foto descargada. Medido:
  ~37% más rápido en descargas consecutivas del mismo host, y genera
  menos "ruido" de conexiones nuevas por segundo.
- **Backoff adaptativo entre descargas**: el delay entre fotos sube tras
  un 429/5xx (hasta un tope de 5s) y se relaja gradualmente tras una racha
  de descargas sin problema, en vez de mantener un ritmo fijo indiferente
  a lo que el servidor está señalando.
- **Resultado medido end-to-end**: el mismo álbum real de 297 fotos pasó
  de 250/297 (84%) a 296/297 (99.7%) con estas 2 mejoras combinadas.

**Cláusula de ToS de Flickr a tener presente antes de escalar a
producción** (no bloqueante para el MVP, sí para revisión legal — ver
`PHOTO_SEARCH_OPS.md` §5): la API prohíbe explícitamente "mostrar más de
30 fotos por página" y "usar una cantidad no razonable de bandwidth".
Escanear 300-500 fotos por búsqueda (server-side, no mostradas al usuario
final salvo las que hacen match) probablemente no es lo que esa cláusula
imaginaba prohibir, pero tampoco es un uso explícitamente amparado — zona
gris de ToS, no un bloqueo técnico. Añadido como riesgo en
`PHOTO_SEARCH_OPS.md` §6 (ver R7).

**Implicación para Modal**: portar `PhotoSource.download()` tal cual (ya
incluye ambas mitigaciones) — no hace falta rediseñar nada, solo no perder
estas dos características al copiar el código a `modal-photo-search/`.

**Descargas en paralelo (14 sep 2026, tras desplegar en Modal)**: el modo
secuencial original (una descarga a la vez) seguía siendo el cuello de
botella en álbumes grandes. Se añadió `max_workers` a `download()` /
`download_with_source_urls()` con un pool de hilos (`ThreadPoolExecutor`)
y una clase nueva, `_AdaptiveRateLimiter`, que hace **thread-safe** el
mismo backoff que antes vivía como variables locales del bucle
secuencial (`current_delay`, `consecutive_ok`) — un 429 visto por
cualquier worker sube el delay compartido para todos, no solo para el
worker que lo vio; una racha de éxitos (contada de forma global) lo
relaja igual que antes. `max_workers=1` (default) sigue usando el camino
secuencial exacto, sin ningún cambio de comportamiento — el camino
paralelo es estrictamente opt-in.

En `photo-search-api/api/find_photos.py` se activó con
`max_workers=DOWNLOAD_WORKERS` (env var `PHOTO_SEARCH_DOWNLOAD_WORKERS`,
default `5`). Resultado medido end-to-end en Modal, mismo álbum real de
297 fotos: **297/297 descargadas, sin ninguna pérdida** — la ejecución
total bajó de ~140s a **118.3s**. Mejora más modesta de lo estimado en
teoría (~35-40s) porque el matching (InsightFace + OCR por foto, sin
paralelizar) domina el tiempo total una vez que la descarga deja de ser
el cuello de botella — la descarga en sí ya no es la parte lenta del
pipeline.

### 15.7. Decisión de plataforma real: Vercel probado y descartado, Modal en producción (14 sep 2026)

Se construyó el endpoint real (no pseudocódigo) en
`mi-dorsal/photo-search-api/` y se probó **primero en Vercel Functions**,
tal como se acordó ("primero Vercel, si no funciona probamos con Modal").
Resultado: **funcionó correctamente en lógica, falló en infraestructura**.

**Lo que se resolvió en Vercel** (quedó documentado por si se revisita):

- Bundle Python de find-my-race supera el límite estándar de 500MB
  (torch+opencv+onnxruntime+easyocr ≈ 850MB reales) → requiere activar
  [Large Functions beta](https://vercel.com/docs/functions/limitations#large-functions-beta)
  vía `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` como env var del proyecto.
- `easyocr` arrastra `torch` con soporte CUDA por defecto (paquetes
  `nvidia-cu13-*`, varios GB) aunque se corre en CPU — se fuerza el índice
  CPU-only de PyTorch (`index_url=https://download.pytorch.org/whl/cpu`)
  instalándolo en su propia capa/paso *antes* de instalar `easyocr`, para
  que la resolución de dependencias de este último encuentre ya
  satisfecho el requisito y no reinstale la variante con CUDA.
- `scikit-image` (dependencia de `insightface`) usa
  `lazy_loader.attach_stub()` en 15 módulos distintos — un mecanismo que
  en tiempo de *import* busca un `__init__.pyi` adyacente para resolver
  submódulos perezosamente. El file-tracer de Vercel no sigue esa
  dependencia dinámica (no es un `import` estático) y nunca incluye esos
  `.pyi` en el bundle final: falla en producción con `Cannot load imports
  from non-existent stub`, aunque `vercel build` local no avise de nada.
  `includeFiles` en `vercel.json` tampoco sirve — solo cubre archivos del
  propio repo, no el virtualenv que crea `uv` durante el build remoto.
  Solución real: un `build.py` (`tool.vercel.scripts.build` en
  `pyproject.toml`) que parchea cada `__init__.py` afectado, sustituyendo
  `attach_stub` por imports directos de los submódulos declarados en su
  `.pyi` — se ejecuta en el propio entorno de build, donde el `.pyi` sí
  existe en disco (solo no viaja al bundle).

**Por qué se descartó de todos modos**: una vez desplegado y respondiendo
200 en `/` (health check), la primera petición real de matching contra el
álbum de prueba (297 fotos) devolvió **504 Function Invocation Timeout**.
Causa raíz confirmada en logs: `/tmp` en Vercel Functions **no persiste
entre invocaciones** (cada invocación puede caer en una instancia nueva),
así que cada petición re-descarga desde cero los pesos de modelo —
InsightFace buffalo_l (~280MB) + detector/reconocedor de EasyOCR
(~200MB) — antes de procesar una sola foto del álbum. Esa descarga sola
consume la mayor parte del límite de 300s del plan Hobby; con el límite
de 800s de Pro habría margen, pero el problema de fondo (recomputar
~500MB en cada invocación) sigue ahí y escala mal con concurrencia.

**Modal resuelve esto de forma estructural**, no como parche: un
`modal.Volume` persistente (`photo-search-model-cache`) montado en
`/cache`, con `HOME=/cache` para que InsightFace y EasyOCR escriban ahí
sus pesos (`~/.insightface`, `~/.EasyOCR`) — se descargan una sola vez y
quedan cacheados entre invocaciones, incluso en frío. Además el límite de
timeout es de 600s configurados (Modal permite horas si hiciera falta,
sin el escalón artificial de los planes de Vercel).

**Resultado medido en Modal, mismo álbum de 297 fotos real**: primera
invocación (cache de modelo en frío) completó en ~2m48s; invocaciones
siguientes reutilizan el volumen y no repiten la descarga de pesos.
Desplegado en:
`https://manuvera08--photo-search-api-fastapi-app.modal.run` (`modal_app.py`,
mismo código `findmyrace/` y `api/find_photos.py` sin cambios — solo
cambió el "pegamento" de despliegue, no la lógica).

**Pendiente antes de conectar Convex a este endpoint**:

- Crear el secret compartido real: `modal secret create
  photo-search-api-secret PHOTO_SEARCH_API_SECRET=<valor>` (bloqueado
  para el agente por política de escritura de secretos — requiere que el
  usuario lo ejecute manualmente) y activar `secrets=[...]` en
  `modal_app.py` (hoy corre sin auth, igual que el despliegue de Vercel).
  El mismo secreto ya está configurado como env var en el proyecto Vercel
  `photo-search-api` (`vercel env add`), por si se revisita esa vía en
  el futuro.
- El repo `mi-dorsal/photo-search-api/` queda con dos rutas de despliegue
  válidas en paralelo (`vercel.json` + `pyproject.toml` para Vercel,
  `modal_app.py` para Modal) — no se ha borrado la ruta Vercel porque el
  código es el mismo (`findmyrace/`, `api/find_photos.py`); solo cambia
  el archivo de despliegue. Modal es la plataforma en uso; Vercel queda
  documentado como descartado pero no eliminado, por si compensa
  revisitarlo si Vercel soluciona la persistencia de `/tmp` o si se sube
  a plan Pro con concurrencia baja donde el cold-start amortiza mejor.

**Actualización (14 sep 2026, más tarde)**: el secret real
(`photo-search-api-secret`) se creó en Modal y la auth quedó activada en
`modal_app.py` (`secrets = [modal.Secret.from_name(...)]`). Verificado en
producción: sin `Authorization` → 401; con el `Bearer` correcto, pasa.

## 16. Integración con Convex — implementada y probada end-to-end (14 sep 2026)

Todo lo que las secciones §2-6 describían como pseudocódigo está ahora
implementado de verdad y desplegado en el deployment real de Convex
(`precious-goshawk-41`). Diferencias reales respecto al pseudocódigo
original (auditadas contra el contrato real de `api/find_photos.py`, no
contra lo que se había imaginado antes de construir el endpoint):

- **`schema.ts`**: tabla `photoSearchJobs` sin `progress` (el endpoint
  Modal es síncrono, no reporta fases intermedias — no hay polling de
  progreso posible con el diseño actual, solo pending→running→done/error)
  ni `thumbnailUrl`/`gpuCostUsd` (no existen en la respuesta real). Añade
  `identityConfirmed` (gate de cara) y `rejectedSelfies` (selfies que no
  pasaron el pre-score de calidad), que sí son reales.
- **`convex/photoSearch.ts`**: `create` (gate Pro vía
  `currentUserHasPremium`, rate limit 20/día, valida que el álbum sea de
  Flickr antes de gastar una llamada a Modal), `cancel`, `getJob`,
  `getResults`, `listMine`, y una `generateSelfieUploadUrl` (mutation
  nueva, no estaba en el pseudocódigo — necesaria para que la UI real
  pueda subir selfies a Storage antes de llamar a `create`). Internas
  (`getJobInternal`, `markRunning`, `markDone`, `markError`,
  `getExpiredJobsInternal`, `deleteJobInternal`) usadas solo desde la
  action y el cron.
- **`convex/photoSearchActions.ts`**: `runJob` — obtiene URLs firmadas de
  las selfies vía `ctx.storage.getUrl()`, hace el `fetch()` POST a
  `${PHOTO_SEARCH_API_URL}/api/find_photos` con
  `Authorization: Bearer ${PHOTO_SEARCH_API_SECRET}`, guarda el
  resultado y, si hay al menos 1 foto encontrada, envía el email
  `photos_found` (ver más abajo).
- **`convex/crons/cleanupPhotoSearch.ts`** + entrada en `cronJobs.ts`
  (03:15 UTC diario) — borra jobs con `expiresAt` vencido. Las selfies ya
  se borran de Storage en cuanto el job termina (`markDone`/`markError`/
  `cancel`), no esperan al cron.
- **Env vars reales configuradas** en el deployment de Convex:
  `PHOTO_SEARCH_API_URL=https://manuvera08--photo-search-api-fastapi-app.modal.run`,
  `PHOTO_SEARCH_API_SECRET` (mismo valor que el secret de Modal).

**Prueba end-to-end real** (mismo álbum de Canfranc-Canfranc/mikemanitasdpm
validado en sesiones anteriores, con `photosUrl` puesto temporalmente en
esa carrera real y revertido después): `photoSearch.create` →
scheduler → `photoSearchActions.runJob` → fetch autenticado a Modal →
297 fotos escaneadas → resultado guardado. `status: "done"`,
`photosScanned: 297`, `durationMs: 93942`. `results: []` porque la
selfie de prueba (un portrait genérico, no una foto real de un corredor
de esa carrera) no coincide con nadie del álbum — el circuito completo
funciona, la ausencia de resultados es del dato de prueba, no del código.

**UI real construida (14 sep 2026, más tarde)**: `/perfil/fotos`
(listado de carreras del usuario con álbum Flickr) y
`/perfil/fotos/[raceId]` (formulario de subida o resultado, según haya
o no un job previo). Mismo patrón de gate Pro que `/mi-sticker`
(redirect a `/premium` si no hay acceso). `queries` nuevas de soporte:
`photoSearch.listRacesWithPhotos`, `photoSearch.getRaceContext`.
Verificado con `next build` y `tsc` limpios; no probado con una sesión
de usuario logueada real en el navegador (requiere credenciales Clerk).

**Email de aviso implementado y probado end-to-end (14 sep 2026, más
tarde)**: `runJob` envía `photosFoundEmail` (nueva plantilla en
`convex/emails/templates/photosFound.ts`, mismo estilo que
`photosAvailable.ts` — grid de hasta 6 fotos + CTA) cuando
`results.length > 0`. No bloqueante: si el email falla, se loggea pero
el job sigue en `status: "done"` (el usuario ya puede ver el resultado
en la UI aunque el email no llegue).

Para que esto funcionara hubo que relajar `myRaceId` de obligatorio a
opcional en `emailDispatch.ts` (`hasLog`/`writeLog`/`dispatchAndLog`) —
exactamente el problema que el pseudocódigo original de §4 ya había
anotado sin resolver: un usuario puede buscar fotos sin tener una
`myRace` inscrita en esa carrera. Cuando no hay `myRaceId`, la
idempotencia de `notificationLog` usa `raceId` en su lugar (ambos
campos ya eran opcionales en el schema, solo faltaba relajarlos en los
argumentos de las funciones). Se añadió el literal `"photos_found"` a
la unión de tipos en `schema.ts` y `emailDispatch.ts`.

Probado de verdad: email real enviado vía Resend a una cuenta de
prueba, `notificationLog` con `delivered: true` y `resendMessageId`
real, confirmado visualmente por el usuario, y verificada la
idempotencia (una segunda llamada con los mismos datos no reenvía).
Datos de prueba (email temporal en el profile, log de notificación,
mutations/action temporales usadas solo para la prueba) limpiados
después.

**Pendiente** (no bloqueante para que el flujo funcione hoy):
- Sin polling de progreso intermedio: el cliente solo puede consultar
  `getJob` para ver si sigue `pending`/`running` o ya llegó a un estado
  terminal — no hay fases (`uploading`/`detecting`/`scanning`) porque el
  endpoint Modal es una sola llamada síncrona, no las reporta.
- La UI no se ha probado con una sesión de usuario real en el navegador.
