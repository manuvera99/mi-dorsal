# Plan: Comunidad de clubs + Ranking por temporada · mi-dorsal (Pro)

> **Estado:** borrador inicial — 10 sep 2026.
> **Decisión confirmada:** todo Pro desde el día 1 (crear, unirse, invitar, ver podium interno, retos). La lectura pública del catálogo y del ranking sigue siendo gratis (SEO + adquisición).
> **Naming:** **club** (preferido), **capitán** (admin único), **dorsal finalizado** (estado verificado), **temporada** = año natural (1 ene – 31 dic), **hilo del club** (timeline del grupo). Coherente con la marca ("el hilo que te une a tu dorsal").
> **Ref. voz:** `docs/core/brand-voice.md` — tuteo, sin postureo, "el club de la semana", "suma dorsales", "el club de la temporada".

---

## 1. Por qué este plan

- Tienes 2.761 carreras indexadas, ~200 usuarios registrados y 0 Pro pagando. El problema no es adquisición, es **retención semanal**.
- Ya tienes un "hilo del corredor" personal. Le falta la capa **"hilo del club"**: el grupo te arrastra de vuelta ("el club ha sumado 412 km esta semana, ¿y tú?").
- Correbirras tiene el ranking 8D (gratis, masivo). Strava tiene clubs globales. ClubRunning tiene 37k usuarios con clubs. **Nadie en el nicho español combina clubs + ranking por temporada con la capa de "dorsal oficial" que ya tienes.** Esa es la grieta.
- "Todo Pro desde día 1" evita el error freemium clásico: abrir el club a free, ver que no convierte, y repintarlo 6 meses después. Si el corredor quiere club, paga.

## 2. Propuesta de valor (copy en la app)

> **"Encuentra tu club, sumad dorsales, sumad kilómetros. La temporada os la lleváis juntos."**

- **Público**:
  - `/clubs` — catálogo SEO de clubs con escudo, CCAA, ciudad, número de miembros, dorsal acumulado, km de temporada, podium de la semana.
  - `/clubs/[slug]` — ficha del club: escudo, descripción, capitán, requisitos, web externa, podium temporada, hilo del club, **"Únete al club"** (redirige a paywall si no eres Pro).
  - `/ranking/clubes` y `/ranking/clubes/[year]` — top 100 global y por CCAA, archivo histórico.
- **Pro (auth)**:
  - `/cuenta/club` — tu club, miembros, ranking interno, invitaciones pendientes, retos activos.
  - `/cuenta/club/crear` — submit para crear club (entra en cola de moderación).

## 3. Modelo de datos (schema Convex)

```ts
// NUEVO: clubs
clubs: defineTable({
  slug: v.string(),                    // url-safe, único, ej "club-atletismo-alicante"
  name: v.string(),                    // "Club Atletismo Alicante"
  city: v.string(),
  region: v.string(),                  // CCAA, para filtro
  description: v.optional(v.string()),
  shieldUrl: v.optional(v.string()),   // subido por el capitán, Convex storage
  externalUrl: v.optional(v.string()), // web oficial del club
  isVerified: v.boolean(),             // flag admin tras validar
  memberCount: v.number(),             // denormalizado
  captainProfileId: v.id("profiles"),
  createdAt: v.number(),
  disbandedAt: v.optional(v.number()),
})
  .index("by_slug", ["slug"])
  .index("by_region", ["region"])
  .index("by_member_count", ["memberCount"])
  .searchIndex("search_name", { searchField: "name" }),

// NUEVO: club_memberships
club_memberships: defineTable({
  clubId: v.id("clubs"),
  profileId: v.id("profiles"),
  role: v.union(
    v.literal("captain"),     // único por club
    v.literal("co_captain"),
    v.literal("member"),
  ),
  joinedAt: v.number(),
  leftAt: v.optional(v.number()),
  dorsalNumber: v.optional(v.string()),
})
  .index("by_club", ["clubId"])
  .index("by_profile", ["profileId"])
  .index("by_club_active", ["clubId", "leftAt"]),

// NUEVO: club_invitations
club_invitations: defineTable({
  clubId: v.id("clubs"),
  invitedProfileId: v.id("profiles"),
  invitedByProfileId: v.id("profiles"),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("declined"),
    v.literal("expired"),
  ),
  createdAt: v.number(),
  expiresAt: v.number(),               // +14 días
  respondedAt: v.optional(v.number()),
})
  .index("by_invited", ["invitedProfileId", "status"])
  .index("by_club", ["clubId", "status"]),

// NUEVO: club_season_stats (materializado, recalculado por cron)
club_season_stats: defineTable({
  clubId: v.id("clubs"),
  year: v.number(),                   // 2026
  totalDistanceM: v.number(),         // km acumulados
  totalRacesFinished: v.number(),     // dorsales finalizados
  totalMembersContributing: v.number(),
  podiums: v.number(),                // top-3 en carrera oficial (cuando haya datos)
  lastUpdatedAt: v.number(),
})
  .index("by_club_year", ["clubId", "year"])
  .index("by_year_ranking_km", ["year", "totalDistanceM"])
  .index("by_year_ranking_races", ["year", "totalRacesFinished"]),

// NUEVO Sprint C4: club_challenges + club_challenge_progress
club_challenges: defineTable({
  clubId: v.id("clubs"),
  title: v.string(),                  // "20 carreras en junio"
  metric: v.union(v.literal("km"), v.literal("races")),
  target: v.number(),
  startDate: v.number(),
  endDate: v.number(),
  createdByProfileId: v.id("profiles"),
  createdAt: v.number(),
})
  .index("by_club", ["clubId"])
  .index("by_club_active", ["clubId", "endDate"]),

club_challenge_progress: defineTable({
  challengeId: v.id("club_challenges"),
  profileId: v.id("profiles"),
  progress: v.number(),               // denormalizado
  updatedAt: v.number(),
})
  .index("by_challenge", ["challengeId"])
  .index("by_profile", ["profileId"]),
```

**Tablas existentes reutilizadas (no romper):**
- `profiles`, `myRaces` (cuenta dorsales finalizados del corredor en la temporada).
- `subscriptions` (gate "todo Pro"). Cualquier mutation de club va precedida de `assertPremium(ctx)` server-side.
- `convex/lib/premium.ts` (helper a crear) — encapsula el check para no repetir.

## 4. Ranking por temporada: la regla del juego

> **"El ranking suma los kilómetros de los dorsales finalizados de cada miembro en la temporada. No cuenta entrenamientos."**

**Por qué esta regla:**
1. Es lo único que ya tienes verificado (resultado oficial por dorsal → `myRaces` con `resultStatus: "finished"`).
2. Coherente con el tagline: "el hilo que te une a tu dorsal". El club suma dorsales, no kilómetros de Strava.
3. Strava ya tiene ranking por km. No compites ahí.

**Reglas exactas:**
- **Ventana**: 1 enero – 31 diciembre del año en curso (temporada natural). Históricamente se podrá consultar cualquier año.
- **Qué cuenta**:
  - `myRaces` con `resultStatus === "finished"`, `resultOfficialTimeSec > 0`, `eventDate` dentro de la temporada.
  - Distancia: la del evento principal, con el override de la distancia seleccionada (cuando aterrice el plan multi-distancia, ver Sprint 2.5 del ROADMAP).
- **Qué no cuenta**: entrenamientos, dorsales retirados (`DNF`), dorsales no inscritos en mi-dorsal.
- **Empate**: más dorsales finalizados; si persiste, más podiums; si persiste, menor `totalTimeSec` acumulado.
- **Actualización**: cron diario 04:00 UTC (`convex/crons/clubSeasonRollup.ts`) que recalcula `club_season_stats` desde cero. Idempotente.
- **Visibilidad**: ranking público por CCAA y global. Detalle por club (lista de miembros) requiere Pro.

**Vistas de ranking:**
- `/ranking/clubes` (público, SEO): top 100 clubs por km y por dorsales. Año selector. Filtro CCAA.
- `/ranking/clubes/[year]` (público): archivo histórico.
- `/ranking/clubes/[year]/[region]` (público): mismo, filtrado por CCAA.
- `/clubs/[slug]/ranking` (Pro): podium del club, ranking interno, evolución semana a semana.

## 5. Funcionalidades de club (qué puede hacer un Pro)

| Función | Quién | Notas |
|---|---|---|
| Buscar clubs | Pro | Búsqueda fuzzy por nombre + filtro CCAA/ciudad. |
| Crear club | Pro (auto-capitán) | Submit → entra en cola (`isVerified: false`) hasta validación admin. |
| Editar escudo, descripción, web externa | Capitán | Convex storage + `@vercel/image` para resize. |
| Invitar a un amigo (por username) | Capitán / Co-capitán | Genera `club_invitations`. Expira en 14 días. |
| Aceptar / rechazar invitación | Pro | Notificación in-app + email transaccional. |
| Salir del club | Cualquier miembro | `leftAt` se setea; no borra histórico. |
| Ver podium del club | Pro | Lista ordenada por km y dorsales. |
| Ver hilo del club | Pro | Eventos pasados de los miembros en orden cronológico. |
| Compartir widget del club | Pro | iframe + OG card (mismo patrón que widget personal). |
| Crear reto de club (mensual o temporada) | Capitán | Métrica km o carreras. Tracking automático. |
| Badge "Club del mes" | Sistema | Al club con mejor ratio km / miembros activos. |

## 6. Lo que NO entra en v1 (y por qué)

- **Ritmo medio del club, % de socios con PR nuevo, gráficas comparativas entre clubs**: requiere más queries y diseño. Year 2.
- **Tienda del club / DorsalSwap del club**: choca con `docs/plans/DORSALSWAP_PLAN.md`. Year 2.
- **Patrocinio de club** (banner en `/clubs/[slug]`): monetización B2B, distinto al modelo self-serve. Year 2.
- **Competiciones entre clubs** (reto "Alicante vs Valencia"): requiere retos configurables por admin. Year 2 si los retos de club triunfan.
- **Federación oficial con RFEA/FEDME**: legalmente delicado y operacionalmente caro. No priorizar.

## 7. UX, copy y tono (reglas duras)

- **Tuteo siempre**. "Únete al club", "suma dorsales", "el club de la semana".
- **"Hilo del club"**, no "feed del club". Reusa la metáfora de marca.
- **"Dorsales finalizados"**, no "carreras corridas". Refuerza el diferenciador.
- **"Temporada 2026"**, no "ranking anual". Coincide con cómo habla el corredor popular.
- **NUNCA** "Comunidad Pro" ni "Plan Teams". El plan sigue siendo **individual**. El club es una **funcionalidad Pro**, no un plan nuevo. Esto simplifica el pricing.
- La ficha del club es **pública** (para SEO y para que el capitán la enseñe a socios). El botón "Únete" lleva al paywall si no eres Pro.

## 8. Plan de implementación (4 sprints, ~6-8 semanas con 1 dev)

### Sprint C1 (semana 1-2): Schema + lectura pública

- [ ] Tablas nuevas en `convex/schema.ts`. Migración Convex.
- [ ] `convex/clubs.ts`: queries `list`, `getBySlug`, `searchByName`, `getRanking(year, region)`. Mutations `create`, `updateShield`, `updateDescription` (capitán).
- [ ] `convex/clubsSeason.ts`: `getClubStats(clubId, year)`, `getSeasonRanking(year, region?)`.
- [ ] `convex/lib/premium.ts`: helper `assertPremium(ctx)` (reutilizable).
- [ ] Páginas: `/clubs` (catálogo), `/clubs/[slug]` (ficha), `/ranking/clubes` (público).
- [ ] Seed inicial: 5-10 clubs reales de Alicante/Valencia/Murcia (los que ya salen en tu newsletter, sin scrapedata).
- [ ] **Feature flag**: lectura abierta, escritura solo Pro. `<Paywall>` aplicado desde el día 1.
- [ ] Anti-patrones: `export const dynamic = "force-dynamic"` en páginas con `useQuery`.

### Sprint C2 (semana 3): Membresía + invitaciones

- [ ] `convex/clubsMembership.ts`: `joinPublicClub`, `leaveClub`, `acceptInvitation`, `declineInvitation`, `inviteToClub` (capitán).
- [ ] `convex/clubsInvitation.ts`: `listMine`, `create`, `expireOld` (cron diario).
- [ ] Página `/cuenta/club` (Pro): mi club, miembros, invitaciones pendientes, botón "salir".
- [ ] Notificación in-app cuando te invitan.
- [ ] Email transaccional: "Te han invitado al club X" (Resend, template nuevo).
- [ ] `<Paywall>` aplicado a todo lo anterior.

### Sprint C3 (semana 4-5): Ranking + cron

- [ ] `convex/crons/clubSeasonRollup.ts`: action diaria 04:00 UTC que recalcula `club_season_stats` para todos los clubs activos. Idempotente.
- [ ] Página `/clubs/[slug]/ranking` (Pro): podium, ranking interno, "evolución últimos 30 días" (mini-gráfica, Recharts ya en stack).
- [ ] Páginas `/ranking/clubes/[year]` y `/ranking/clubes/[year]/[region]` (públicas, archivo histórico).
- [ ] `<ClubShield size="sm|md|lg">` componente (reutilizable en home, header, ranking, widgets).
- [ ] OG dinámico para `/clubs/[slug]` con escudo + km temporada (mismo patrón que `carreras/[slug]`).
- [ ] JSON-LD pre-serializado: `SportsOrganization` para la ficha, `ItemList` para el ranking.

### Sprint C4 (semana 6-7): Retos de club + pulido

- [ ] Tablas `club_challenges` y `club_challenge_progress` en schema.
- [ ] Mutations para crear reto (capitán) y registrar progreso.
- [ ] Vista "Retos activos del club" en `/cuenta/club` (Pro).
- [ ] "Badge del mes" (cron): club con mejor ratio km / miembros activos. Mostrar en `/clubs/[slug]` y en ranking.
- [ ] Widget público iframe: "Así va nuestro club" (escudo + km temporada + posición regional). Reutiliza el patrón del widget personal.
- [ ] Dropdown/popover del filtro CCAA en `/ranking/clubes` → **portal a `document.body`** (mismo patrón que `RegionSwitcher`).

### Sprint C5 (semana 8): lanzamiento + docs

- [ ] Post en blog "Historias de dorsal": "Cómo medimos la temporada de tu club" (transparencia, anti-agregador).
- [ ] Email a la lista: "Llega el club a mi-dorsal" (con los 5-10 clubs semilla como ejemplo).
- [ ] Landing `/pro` actualizada con la nueva sección "Clubs y ranking".
- [ ] `docs/core/clubs.md`: cómo se calcula el ranking, qué cuenta, qué no.
- [ ] `docs/optional/clubs-ops.md`: moderación de clubs nuevos, validaciones, anti-spam.
- [ ] Actualizar `ROADMAP.md`: mover tareas C1-C5 a "Historial" cuando se cierren.

## 9. Anti-patrones respetados (recordatorio del `AGENTS.md` §2)

- Páginas con `useQuery` / datos de club → `export const dynamic = "force-dynamic"`.
- JSON-LD pre-serializado en build para `/clubs/[slug]` y `/ranking/clubes`.
- Dropdowns/popovers del ranking (filtro CCAA) → portal a `document.body`.
- Webhook legacy intacto, sin tocar.
- **Nunca `git add -A`**: commits selectivos por sprint.
- **`npm run build` local antes de `git push`**, especialmente en `convex/schema.ts` (TS2589, ya documentado).
- Tests visuales (DevTools screenshot) tras el primer deploy de cada sprint.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Spam de clubs falsos | Moderación manual en v1 (`isVerified: false` por defecto, panel admin). Auto-aprobación solo para usuarios con >3 carreras finalizadas. |
| Ranking manipulado (clubs que suman a propósito) | Solo cuentan dorsales con resultado oficial (`resultStatus: "finished"`). No hay forma de inflar sin haber corrido. |
| Clubs que desaparecen | `disbandedAt` opcional; no se borra el histórico. El club no aparece en el catálogo pero sí en `/ranking/clubes/[year]`. |
| Performance del cron con 5.000 clubs | Query agregada sobre `myRaces` indexado por `eventDate` + filtro en memoria. Si pasa de 1.000 clubs activos, introducir `club_season_daily_snapshots` para cálculo incremental. |
| Acusaciones de "tracker de Strava" | Documentar la regla en `/clubs/[slug]` y en `docs/core/clubs.md`. No usamos Strava para el ranking. |
| Churn por fricción ("solo lo uso yo") | Capitán puede invitar a 5-10 amigos con un click. Email de "primer socio" + reto inicial. |
| Clubs que se sienten "pagados" | Página pública, escudo, web externa gratis. La suscripción es del corredor, no del club. El club es gratis para el capitán. |

## 11. Métricas a vigilar (primeras 8 semanas)

- **Adopción**: % de Pro que crea o se une a un club (meta: 30% en mes 2, 50% en mes 4).
- **Engagement**: dorsal finalizado / semana de socios de club vs no socios (meta: +40%).
- **Retención Pro**: 30-day retention de Pro con club vs sin club (meta: +15 puntos).
- **SEO**: visitas orgánicas a `/clubs` y `/ranking/clubes` (meta: 5% del tráfico total en mes 3).
- **Coste**: query calls/mes de las páginas de club. Límite blando: 5% del total. Si lo supera, cachear `getSeasonRanking` con TTL 1h.
- **Anti-abuso**: nº de clubs rechazados en moderación, nº de invitaciones reportadas como spam.

## 12. Coste y retorno esperado

- **Implementación**: 6-8 semanas, 1 dev. Ya hay schema, auth, paywall y cron patterns. Coste infra adicional: <$5/mes (queries extra sobre `myRaces`).
- **Conversión esperada**: si el club convierte al +20% de Pro que están "mirando sin usar" (los 200 usuarios free actuales), **+5-10 Pro adicionales en 90 días**. A 2,99 €/mes son **+15-30 €/mes MRR**. Pequeño en absoluto, enorme en palanca de retención.
- **SEO**: las páginas de club y ranking capturan long-tail tipo "ranking clubes running valencia 2026", "club atletismo alicante dorsal", "clubes de trail murcia". Con 200-500 clubs indexados, son 500-1.000 páginas nuevas SEO-friendly, una mina para AdSense (Pata 1) y afiliación (Pata 2).
- **Defensibilidad**: clubs con dorsal finalizado = datos únicos. No se replican con un scraping de Strava. Es un **moat real** que crece con el uso.

## 13. Decisiones pendientes (necesito de Manu)

1. **Slug URL**: confirmar formato `club-atletismo-alicante` (slugify) vs `club-atletismo-alicante-2026` (con temporada). Recomiendo el primero.
2. **Seed inicial**: ¿me pasas la lista de los 5-10 clubs reales que quieres que aparezcan desde día 1? Recomiendo los que ya salen en tu newsletter de Levante (CAU, C.A. Maratón Valencia, C.A. Murcia, etc.).
3. **Moderación de clubs nuevos**: ¿aprobación manual 100% o auto-aprobación para usuarios con >3 carreras finalizadas? Recomiendo el mix.
4. **CTA del paywall**: ¿agresivo ("Solo Pro, 2,99 €/mes, únete ya") o blandito ("Únete al club — solo para socios Dorsal Pro")? Recomiendo el agresivo: si pagas, pagas; si no, el catálogo público sigue siendo gratis.
5. **Email transaccional de invitación**: ¿lo mandamos siempre o solo cuando el invitado es Pro? Recomiendo solo si el invitado es Pro (evita emails a no-socios).

---

## 📚 Documentos relacionados

| Tema | Doc |
|---|---|
| Pricing y tiers | `docs/plans/MONETIZATION_FREEMIUM_TIERS.md` |
| Monetización general | `docs/plans/MONETIZATION_PLAN.md` |
| Roadmap principal | `docs/ROADMAP.md` (Sprint 4 "Clubs") |
| Identidad de marca | `docs/history/brand-identity.md` |
| Tono y copy | `docs/core/brand-voice.md` |
| Naming y dominios | `docs/history/naming-decisions.md` |
| DorsalSwap (year 2) | `docs/plans/DORSALSWAP_PLAN.md` |
| Reglas del proyecto | `docs/core/anti-patterns.md` |

---

*Documento vivo. Editar y commitear con cuidado: usa `git add docs/plans/CLUBS_RANKING_PLAN.md` (nunca `git add -A`).*
