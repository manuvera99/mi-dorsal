# Próximas iteraciones pendientes

> Documento opcional. Roadmap vivo, se revisa mensualmente.

## Branding

- [ ] Migrar la paleta de color al rebranding "Verano en el Levante" (E63946 / 1D3557 / 2A9D8F / F4A261).
- [ ] Adoptar `Bricolage Grotesque` o `Sora` como display font.
- [ ] Logo simplificado para favicon 16/32/180/192/512 px.

## SEO y descubrimiento

- [ ] ItemList dinámico en `/carreras` con slugs reales (requiere query en Server Component).
- [ ] Arreglar `races:listForSitemap` en Convex para que el sitemap funcione.
- [ ] OG image custom 1200×630 con dorsal estilizado y tagline (mejora CTR en WhatsApp/Twitter/LinkedIn).

## Contenido y social

- [ ] Testimonios reales (sustituir el array `TESTIMONIALS` en `components/home/testimonials.tsx`).
- [ ] Comprar `mi-dorsal.run` defensivo (~24 €/año) cuando apetezca.
- [ ] Asegurar `@midorsal` en IG, TikTok, X, YouTube, Threads, Bluesky.
- [ ] Landing `/newsletter` mejorada con social proof.

## Producto

- [ ] Cuando Vercel inyecte `x-vercel-ip-country-region` consistentemente, simplificar el endpoint `/api/geo/region`.
- [ ] PWA: prompt de instalación en Android/iOS tras 2 visitas.
- [ ] App nativa iOS/Android (roadmap 2026-2027).

## Marca y naming

- [ ] Configurar email corporativo con Zoho Mail free (5 buzones) — ver `docs/history/naming-decisions.md`.
- [ ] Limpiar inconsistencias de naming en el código (midorsal vs mi-dorsal en metadata, copy, OG) — ver `docs/history/naming-decisions.md`.
- [ ] Registrar marca `mi-dorsal` en OEPM (clases 9, 41, 42) — ~150 €, 8-12 meses resolución — ver `docs/history/naming-decisions.md`.

## Billing (ya listo, no activado)

- [x] **Esqueleto de Clerk Billing listo** (8 sep 2026) — schema `subscriptions` + webhook Svix + páginas `/premium` y `/cuenta/suscripcion` + componentes `<Paywall>` y `<PremiumBadge>`. Activar cuando llegue Q3-Q4 2026 siguiendo `docs/BILLING_SETUP.md`. Ver `docs/optional/billing-monetization.md`.
- [x] **Plan de negocio + roadmap de infra** (8 sep 2026) — `docs/BUSINESS_PLAN.md` + `docs/INFRA_ROADMAP.md`.
