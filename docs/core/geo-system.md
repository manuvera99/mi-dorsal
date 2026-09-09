# Sistema de geolocalización (CCAA)

> Documento on-demand. Se carga cuando se toca el RegionSwitcher, el endpoint de geo, o el filtrado por CCAA.

## Stack

- **`lib/geo/region.ts`** — Single source of truth. Define `AUTONOMOUS_COMMUNITIES`, `getCommunityByProvince()`, `getCommunityById()`, `detectCommunityFromString()`. 19 CCAA + Ceuta + Melilla.
- **`app/api/geo/region/route.ts`** — Edge endpoint. Lee `x-vercel-ip-country-region` y `x-vercel-ip-city` de Vercel. Cache 24h con `Cache-Control`. Soporta `?ccaa=valencia` para override.
- **`components/use-user-region.ts`** — Hook con `localStorage` (`midorsal:ccaa`). 1) Lee override manual, 2) Llama al endpoint, 3) Expone `setCommunity` y `clearOverride`.
- **`components/region-switcher.tsx`** — Pill en el hero + dropdown con **portal a `document.body`** (esencial: el hero tiene `overflow-hidden` para las luces decorativas, sin portal el dropdown se recorta).
- **`/api/geo/ip` está DEPRECATED** — devuelve 410 Gone. Devolver IP del servidor Vercel en lugar de la del cliente. **No usar.**

## Limitación conocida

Vercel en plan hobby/free inyecta `x-vercel-ip-city` y `x-vercel-ip-country` pero **no siempre** `x-vercel-ip-country-region`. En producción típica, el endpoint devuelve `source: "default"` y la home muestra "Las que más molan este mes" en lugar de "Cerca de ti". El usuario puede arreglarlo con el selector manual.
