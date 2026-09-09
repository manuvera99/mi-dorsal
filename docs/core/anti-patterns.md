# Anti-patrones — lo que NO hacer

> Documento core. Crítico. Si dudas de una acción, vuelve a leerlo.

1. **No reordenar las 11 secciones de la home** sin discutirlo (ver `docs/core/home-structure.md`).
2. **No quitar `force-dynamic`** de las páginas con queries.
3. **No introducir JSON-LD construido en runtime** — siempre pre-serializar o usar `dangerouslySetInnerHTML` con string.
4. **No hacer dropdowns sin portal** si pueden acabar dentro de un `overflow-hidden`.
5. **No usar `/api/geo/ip`** — usar `/api/geo/region`.
6. **No escribir copy que limite a Levante** — la app cubre toda España.
7. **No usar testimonios como si fueran reales** sin verificar — la home tiene disclaimer explícito.
8. **No usar `git add -A` sin revisar `git status` antes**.
9. **No desplegar sin verificar 200 OK y 0 errores 500** en los logs de Vercel.
10. **No prometer "toda España" sin geo** — si la IP no se detecta, mostrar fallback honesto, no fingir personalización.
11. **No eliminar la hamburguesa / panel mobile del header** (`components/header.tsx`) — la nav desktop es `hidden` en móvil y solo el panel cubre <768 px. Sin él, Carreras, Perfil, Calendario y Ranking quedan inaccesibles.
12. **No pushear a `master` sin haber ejecutado `npm run build` local primero**. `tsc --noEmit` no es suficiente — Vercel detecta typechecks más estrictos (inferencias de Convex, tipos profundos, etc.) que local puede pasar por alto. Saltarse el build local ha costado 5+ deploys rotos seguidos. Ver `docs/core/deploy-checklist.md`.
