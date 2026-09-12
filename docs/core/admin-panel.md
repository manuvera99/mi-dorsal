# Panel admin (`/admin/*`)

> Documento on-demand. Se carga cuando se toca cualquier página bajo `app/admin/`.
> Protegido por `clerkMiddleware` + `profiles.role === "admin"` (ver `middleware.ts`, patrón `/admin(.*)`).

| Ruta | Qué hace | Tabla(s) que gobierna |
|---|---|---|
| `/admin` | Dashboard. Lee de `statsCache` (no consulta tablas en vivo). | `statsCache` |
| `/admin/races`, `/races/new`, `/races/[id]`, `/races/from-url` | CRUD manual de carreras. `from-url` lanza deep extraction con IA. | `races` |
| `/admin/sources`, `/sources/from-url` | Lista `dataSources` con último sync, botón "sincronizar ahora". | `dataSources`, `syncHistory` |
| `/admin/duplicates` | Detecta carreras duplicadas (exact/structural/fuzzy) como red de seguridad — `systemUpsert` ya previene la mayoría en el ingest desde 2026-09-12. Solo BORRA, no hace merge. Ver `docs/optional/enrichment.md`. | `races` |
| `/admin/users`, `/users/[id]` | Lista de profiles con métricas + detalle para soporte. | `profiles` |
| `/admin/blog`, `/blog/new`, `/blog/[id]` | CRUD del blog, editor markdown. | `blogPosts` |
| `/admin/newsletter` | Suscriptores, filtros, export CSV, alta/baja manual. | `newsletterSubscribers` |
| `/admin/feedback` | Revisar bug/idea/feedback reportado por usuarios. | `feedbackReports` |
| `/admin/race-suggestions` | Convertir sugerencias de carrera (URL pegada por un user) en carreras reales. | `raceSuggestions` |
| `/admin/club-suggestions` | Revisar clubs que un user no encontró en el selector. | `clubSuggestions` |
| `/admin/clubs` | Catálogo extendido de clubs manuales (precedencia sobre RFEA en duplicado). | `clubsCatalog` |
| `/admin/ai-usage` | Gráfica diaria de tokens/coste de llamadas a LLM, desglose por función y modelo. | `aiUsageLog` |

CLI del blog (fuera del panel web): `npm run content:new` / `npm run content:publish` — ver `docs/core/blog-newsletter.md`.
