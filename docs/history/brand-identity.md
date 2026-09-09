# Identidad visual de marca

> Documento histórico. Se carga solo cuando se toca branding, paleta, tipografía o logo.

## Paleta de color (Tailwind config `app/globals.css`)

| Token | Hex | Uso |
|---|---|---|
| `--runner-primary` | `220 38 38` (#dc2626) | Primario. Rojo asfalto popular. |
| `--runner-accent` | `22 163 74` (#16a34a) | Secundario. Verde. |
| `--runner-warm` | `250 250 249` (#fafaf9) | Fondo principal. Crema, no blanco puro. |
| `--runner-dark` | `10 10 10` (#0a0a0a) | Texto principal. Negro suave. |

> **No se ha migrado aún a la paleta extendida propuesta en el plan de branding** (Verano en el Levante: `--dorsal-red: #E63946`, `--asfalto-700: #1D3557`, `--hierba-500: #2A9D8F`, `--naranja-salida: #F4A261`). El rojo `#dc2626` actual funciona pero es el mismo rojo "navidad" que Strava. **Migración pendiente — no aplicar sin rediseño completo de paleta.**

## Tipografía

- **Sans / UI**: `Inter` (ya en `globals.css` y `tailwind.config.ts`).
- **Mono / números de dorsal y tiempos**: `JetBrains Mono` (ya en `tailwind.config.ts`).
- **Display / logo**: aún sin definir. `Sora` o `Bricolage Grotesque` como candidatas, **no adoptadas todavía**.

## Logo e isotipo

- Versión actual: `public/icon.svg`, `public/icon-mono.svg`, `public/logo.svg`. Estilo: isotipo con forma de dorsal estilizado + "hilo" curvo.
- **NO redibujar el logo** sin discutirlo. Si necesitas variantes, partir del SVG actual.
