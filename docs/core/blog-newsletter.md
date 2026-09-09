# Blog "Historias de dorsal" + Newsletter — sistema editorial

> Documento opcional. Se carga cuando se toca el blog, la newsletter, el cron editorial, o el admin de contenido.

Implementado el 5 sep 2026 para captar tráfico orgánico SEO y mantener engagement con suscriptores (registrados y externos).

## Decisión de naming y dirección

- **Blog**: "Historias de dorsal" (encaja con el "hilo que te une a tu dorsal"). URL: `/blog`.
- **Newsletter**: solo "Newsletter mi-dorsal". URL pública: `/newsletter`.
- **NO se compite** con Runnea, Foroatletismo, Runner's World, etc. (medios generalistas de running). Posicionamiento: contenido específico del corredor popular con datos reales de carreras españolas.
- **Frecuencia recomendada**: 1 post/semana escrito por Manu (sostenible, sin fábrica de contenido).
- **Categorías (4, no más)**: historias, guias, curiosidades, tendencias.

## Arquitectura

```
app/
  blog/                          # público
    page.tsx                     # Server Component, force-dynamic + metadata
    client.tsx                   # Client con useQuery(api.blog.list)
    [slug]/page.tsx              # Server con generateMetadata + Schema.org Article
    [slug]/client.tsx            # MarkdownRenderer + incrementViews + related
    categoria/[cat]/page.tsx     # SEO long-tail por categoría
  newsletter/                    # landing pública de suscripción
    page.tsx
  api/newsletter/
    subscribe/route.ts           # POST: crea pending + envía email confirmación
    confirm/route.ts             # GET: doble opt-in (token)
    unsubscribe/route.ts         # GET: baja (token)
  admin/
    blog/                        # CRUD admin
      page.tsx                   # lista con filtros
      new/page.tsx               # crear
      [id]/page.tsx              # editar
    newsletter/page.tsx          # gestión suscriptores
components/
  blog/
    PostCard.tsx
    MarkdownRenderer.tsx         # parser ligero, sin librería externa
  newsletter/
    NewsletterForm.tsx           # form público con feedback
convex/
  schema.ts                      # tablas blogPosts + newsletterSubscribers
  blog.ts                        # queries + mutations (admin / pública)
  newsletter.ts                  # subscribe/confirm/unsubscribe + admin
  crons/
    newsletterEditorial.ts       # cron día 1 mes, 10:00 UTC
  cronJobs.ts                    # registro del cron
scripts/content/
  generate-post.ts               # CLI: crea esqueleto por categoría
  publish-post.ts                # CLI: sube MD a Convex
  blog-publisher.ts              # helper compartido
  drafts/                        # borradores (en .gitignore)
  README.md                      # instrucciones
```

## Tablas Convex

**`blogPosts`** (slug único, content en markdown):
- `slug`, `title`, `excerpt`, `content`, `coverImageUrl`, `coverImageAlt`
- `category`: historias | guias | curiosidades | tendencias
- `tags[]`, `authorId`, `authorName`, `publishedAt`, `isPublished`, `isFeatured`
- `seoTitle`, `seoDescription`, `seoKeywords[]`, `readingTimeMinutes`
- `views`, `relatedRaceIds[]` (FK a races para internal linking)
- `newsletterSentAt` (se setea al enviar por el cron)
- Índices: by_slug, by_published_date, by_category, by_featured, search_blog

**`newsletterSubscribers`** (doble opt-in RGPD):
- `email`, `status`: pending | active | unsubscribed | bounced
- `source`: blog | landing | footer | admin | import
- `preferences`: { editorialEnabled, raceRemindersEnabled, resultsEnabled }
- `confirmToken` (one-shot), `unsubscribeToken` (estable)
- `subscribedAt`, `confirmedAt`, `unsubscribedAt`, `lastSentAt`
- `subscriptionIpHash` (SHA-256 con salt, RGPD), `subscriptionUserAgent`
- `profileId` (FK opcional a profiles si el suscriptor también es usuario)
- Índices: by_email, by_status, by_status_locale, by_status_editorial, by_profile

## Doble opt-in (RGPD España LSSI)

Flujo obligatorio:
1. Usuario envía email en `/newsletter` → POST `/api/newsletter/subscribe`.
2. Backend hashea la IP con SHA-256 + salt (`NEWSLETTER_IP_SALT` o default) y guarda suscriptor en `status: pending` con `confirmToken`.
3. Backend envía email de confirmación con link `/api/newsletter/confirm?token=...`.
4. Usuario hace click → backend llama `api.newsletter.confirm` → marca `status: active`, limpia `confirmToken`.
5. Suscriptor queda activo, listo para recibir emails.

**Baja**: cada email lleva link `/api/newsletter/unsubscribe?token={unsubscribeToken}` (token estable, no cambia). El `unsubscribeToken` se genera al crear el suscriptor y se mantiene aunque se re-suscriba.

**IMPORTANTE**: NUNCA guardar IP en claro. Siempre hashear. La sal `NEWSLETTER_IP_SALT` debe estar en env vars en producción (no commitear).

## Cron `newsletter-editorial`

- **Schedule**: día 1 de cada mes, 10:00 UTC.
- **Lógica**: coge el post más reciente (`isPublished=true`) que aún no tenga `newsletterSentAt`. Envía a todos los suscriptores activos con `editorialEnabled=true`.
- **Dry-run**: `internal.crons.newsletterEditorial.newsletterEditorial({ dryRun: true })` para probar sin enviar nada.
- **Mock mode**: si no hay `RESEND_API_KEY`, loguea en stdout y NO marca nada como enviado.
- **Email**: HTML inline (sin `@react-email/components` para esta plantilla simple). Subject: "Nueva historia de dorsal: {title}".

## Comandos CLI

```bash
# Crear esqueleto
pnpm content:new historias "Mi primera Behobia"
pnpm content:new guias "Cómo preparar una media maratón"
pnpm content:new curiosidades "Por qué el 10K es la distancia más democrática"
pnpm content:new tendencias "Qué buscar en unas zapatillas para trail en invierno"

# Publicar (queda como borrador)
pnpm content:publish scripts/content/drafts/2026-09-05-mi-post.md

# Publicar y publicar inmediatamente
pnpm content:publish scripts/content/drafts/2026-09-05-mi-post.md --publish
```

Más detalles en `scripts/content/README.md`.

## Lo que NO hacer

- **No** enviar emails sin doble opt-in (RGPD España). El sistema ya lo implementa, no saltarlo.
- **No** guardar IP en claro. Siempre hashear.
- **No** añadir más de 4 categorías (fragmenta SEO).
- **No** generar posts con LLM sin que Manu los revise y edite. La voz de marca se rompe.
- **No** programar el cron para enviar más de 1 vez/mes (cansancio + baja engagement).
- **No** usar el sistema de blog para comunicar cambios de producto. Eso va en la home o en banners.
- **No** quitar el campo `newsletterSentAt` del post. Es lo que evita re-envíos.
- **No** hacer el NewsletterForm con doble confirmación al hacer click (ya hay doble opt-in vía email).

## Roadmap editorial (próximos 90 días)

- [ ] Publicar 4 posts de "Historias de dorsal" (1/semana).
- [ ] Llegar a 100 suscriptores activos en la newsletter.
- [ ] Medir tráfico orgánico a `/blog/*` desde Search Console (objetivo: 200 visitas/mes desde SEO).
- [ ] Medir conversión newsletter → registro en mi-dorsal (objetivo: 10% de los suscriptores).
- [ ] A/B testing de asuntos de email (fase 2).
- [ ] Si el blog tira bien, valorar `Bricolage Grotesque` o `Sora` para el wordmark.
