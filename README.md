# 🏃 mi-dorsal

> **El hilo que te une a tu dorsal.**
> Planificador personal de carreras con tracking automático de dorsales, predicción de tiempos y auto-push de resultados por email.

## Estado

**🟢 Funcionando en modo MOCK** en `http://localhost:3001`
- 7 páginas: home, catálogo, ficha de carrera, ranking, calendario, perfil
- 12 carreras de ejemplo (Levante: Alicante, Valencia, Murcia, Albacete)
- 3 PRs ficticios del usuario mock
- Votación 8D funcional con sliders
- Predicción de tiempos con Daniels VDOT

**Pendiente para producción:**
- Crear cuentas en Clerk, Convex, Resend (15 min)
- Configurar variables de entorno (5 min)
- Desplegar a Vercel (10 min)

Ver [SETUP.md](./SETUP.md) para instrucciones paso a paso.

---

## Features (Ola 1 — MVP)

- [x] **Catálogo de carreras** de toda España con filtros (provincia, mes, tipo, búsqueda)
- [x] **Votación 8D** de la comunidad (8 sliders 0-10 + comentario)
- [x] **Top 10 ranking** con 🥇🥈🥉 y mínimos de 3 votos
- [x] **Login con magic link** (Clerk)
- [x] **Calendario personal** con carreras planeadas + dorsal
- [x] **Predicción de tiempos** con Daniels VDOT + Riegel fallback + ajustes
- [x] **Track dorsal + email resultado + diploma PDF** (cron `check-results`)
- [x] **Recordatorios 7d/1d** pre-carrera (cron `reminder-pre-race`)
- [x] **Year in review** anual (cron `year-review`)
- [x] **PRs manuales** (5K, 10K, Media, Maratón)
- [x] **Perfil público** con temporada, top carreras, estadísticas

## Features (Ola 2 — futuro)

- [ ] Strava OAuth + lectura activities + VO2max
- [ ] Garmin OAuth
- [ ] Predicción calibrada con HR zones, ACWR, training load
- [ ] Comparador A vs B
- [ ] Pronóstico meteorológico race day
- [ ] Detección conflictos calendario

---

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind
- **Backend:** Convex (DB + cron + storage + reactive queries)
- **Auth:** Clerk (magic link)
- **Email:** Resend
- **PDF:** @react-pdf/renderer
- **Scraping:** cheerio
- **Algoritmo:** Daniels VDOT + Riegel (en `lib/prediction/`)
- **Hosting:** Vercel

---

## Estructura

```
mi-dorsal/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home
│   ├── carreras/                 # Catálogo + ficha
│   ├── ranking/                  # Top 10
│   ├── calendario/               # Calendario personal
│   ├── perfil/                   # Perfil + PRs
│   ├── layout.tsx
│   └── globals.css
│
├── components/                   # React components
│   ├── ConvexClientProvider.tsx
│   ├── header.tsx
│   ├── footer.tsx
│   ├── race-card.tsx
│   ├── race-filters.tsx
│   └── rating-sliders.tsx
│
├── convex/                       # Backend completo
│   ├── schema.ts                 # 8 tablas
│   ├── auth.config.ts            # Clerk JWT
│   ├── crons.ts                  # 4 cron jobs
│   ├── _helpers.ts               # Auth helpers
│   ├── _generated/               # Auto-generado (stubs)
│   ├── races.ts                  # Queries + mutations
│   ├── ratings.ts                # Votaciones
│   ├── myRaces.ts                # Calendario
│   ├── personalRecords.ts        # PRs
│   ├── predictions.ts            # Accuracy stats
│   ├── users.ts                  # Profile
│   ├── scraper.ts                # Adapters resultados
│   ├── crons/                    # Implementación crons
│   │   ├── checkResults.ts
│   │   ├── reminderPreRace.ts
│   │   ├── weeklyDigest.ts
│   │   └── yearReview.ts
│   ├── emails/
│   │   ├── sendEmail.ts
│   │   └── templates/
│   │       └── resultFound.ts
│   └── pdf/
│       └── diploma.tsx
│
├── lib/                          # Lógica compartida
│   ├── prediction/               # Algoritmo de predicción
│   │   ├── daniels-vdot.ts
│   │   ├── riegel.ts
│   │   ├── adjustments.ts
│   │   ├── types.ts
│   │   └── predict.ts
│   ├── mock/                     # Datos mock para dev
│   │   ├── data.ts
│   │   └── provider.tsx
│   └── utils.ts
│
├── .env.example                  # Plantilla
├── .env.local                    # (gitignored) tus credenciales
├── SETUP.md                      # Guía de deployment
├── convex.json
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Comandos

```bash
# Modo MOCK (sin credenciales)
NEXT_PUBLIC_USE_MOCK=true npm run dev
# o
npm run build && npm start

# Modo REAL (con Convex + Clerk)
npx convex dev      # en una terminal
npm run dev         # en otra

# Build
npm run build
npm start

# Deploy a Vercel (después de subir a GitHub)
vercel --prod
```

---

## Variables de entorno

Ver `.env.example`. Las mínimas para producción:

| Variable | Dónde conseguirla |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | https://dashboard.convex.dev |
| `CLERK_SECRET_KEY` | https://dashboard.clerk.com |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | https://dashboard.clerk.com |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk → JWT Templates → Convex |
| `RESEND_API_KEY` | https://resend.com/api-keys |

---

## Roadmap

- [x] Setup proyecto + Convex + Clerk + Tailwind (esta sesión)
- [x] Schema de 8 tablas
- [x] Backend: races, ratings, myRaces, PRs, predictions
- [x] 4 cron jobs implementados
- [x] Scraper genérico + adapters específicos
- [x] Algoritmo de predicción Daniels VDOT
- [x] UI: 7 páginas con datos mock
- [x] Email templates (HTML)
- [x] Generador de diploma PDF
- [ ] **Producción:** Crear cuentas Clerk/Convex/Resend y desplegar
- [ ] Ola 2: Strava/Garmin OAuth, comparador, clima

---

## Decisión técnica: Convex en lugar de Supabase

Ver `docs/convex-decision.md` para la comparativa completa. Resumen: Manu agotó su free tier de Supabase. Convex ofrece todo en un único servicio (DB + auth + storage + cron + reactive queries) con TypeScript end-to-end.

---

## Créditos

Inspirado en:
- [Correbirras](https://www.correbirras.com) — por el UX de votación 8D
- [McMillan Running Calculator](https://www.mcmillanrunning.com) — por la idea de predicción calibrada
- [UTMB Index](https://utmb.world/utmb-index) — por el loop predicción → resultado → aprendizaje

---

**Hecho con ❤ por un corredor para corredores. v0.1**
