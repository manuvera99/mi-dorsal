# Estructura de `/carreras`

> Documento on-demand. Se carga cuando se toca el catálogo o `app/carreras/`.

Estructura actual, **no reordenar sin motivo**:

1. **CarrerasHero** (`components/carreras/carreras-hero.tsx`) — H1 dinámico ("Carreras populares en [CCAA]" o "toda España"), buscador grande, trust signals.
2. **RaceDistanceFilter** (existente) — GPS + slider. Estado concedido renderiza como **pill minimalista** con check + "Ubicación activa · GPS", sin coordenadas decimales.
3. **QuickFilterChips** (`components/carreras/quick-filter-chips.tsx`) — Pills horizontales de distancia y mes con 1 click. Scroll horizontal en móvil, meses pasados dim.
4. **AdvancedFilters** (`components/carreras/advanced-filters.tsx`) — Acordeón cerrado por defecto. Provincia, tipo, organizadora, distancia múltiple.
5. **Header de resultados** — Contador + sort (fecha/nombre/votos) + toggle lista/mapa.
6. **Carruseles por afinidad** (solo si `activeFilterCount === 0`):
   - Cerca de ti (CCAA detectada) — `RaceCarousel` con icono `MapPin` y accent `primary`.
   - Próximamente (cronológico) — icono `Calendar`.
   - Las más votadas — icono `Sparkles`, accent `amber`.
7. **Modo mapa** (alternativo a grid) — `RaceMapWrapper` con aviso de carreras sin coordenadas.
8. **Grid completo** — Resto de carreras, ordenadas por `sortBy`.
9. **Empty state emocional** — Copy contextual según filtros/distancia/resultados.

## `app/carreras/page.tsx` y `client.tsx`

- `page.tsx` es **Server Component** con metadata SEO y `force-dynamic`.
- `client.tsx` (`app/carreras/client.tsx`) es **Client Component** que recibe la query de Convex. **Toda la lógica interactiva va aquí.**
- Schema.org `BreadcrumbList` + `ItemList` en `components/carreras/carreras-seo.tsx`. El ItemList es estático con `numberOfItems: 1200` (estimado). **Para hacerlo dinámico real**, mover la query Convex al Server Component.
