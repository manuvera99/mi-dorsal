# Content pipeline (blog "Historias de dorsal")

Pequeño sistema para que Manu (o un colaborador) escriba posts del blog
sin tener que pelearse con la UI del admin. **No automatiza la escritura**;
solo acelera el flujo:

1. **Generar esqueleto** con plantilla según categoría.
2. **Escribir** en markdown (VSCode, Obsidian, lo que sea).
3. **Publicar** desde CLI, con frontmatter YAML.

## Comandos

```bash
# Crear un esqueleto
pnpm content:new historias "Mi primera Behobia"
pnpm content:new guias "Cómo preparar una media maratón en 12 semanas"
pnpm content:new curiosidades "Por qué la Behobia es la carrera más democrática"
pnpm content:new tendencias "Qué buscar en unas zapatillas para trail en invierno"

# Publicar (queda como borrador en /admin/blog)
pnpm content:publish scripts/content/drafts/2026-09-05-mi-primera-behobia.md

# Publicar y publicar inmediatamente
pnpm content:publish scripts/content/drafts/2026-09-05-mi-primera-behobia.md --publish

# Solo validar (no sube nada)
pnpm content:publish scripts/content/drafts/2026-09-05-mi-primera-behobia.md --dry-run
```

## Frontmatter

El archivo generado tiene este frontmatter (rellena los TODO antes de publicar):

```yaml
---
title: "Título del post"                      # obligatorio
slug: "titulo-en-kebab-case"                  # opcional, se genera del title
excerpt: "Resumen de 1-2 frases"              # obligatorio, ~200 chars
category: historias                           # obligatorio
tags: [behobia, 10k, san-sebastian]          # opcional
seoTitle: "Título SEO ≤ 60 chars"             # opcional
seoDescription: "Descripción SEO ≤ 160"       # opcional
publish: false                                # opcional, default false
featured: false                               # opcional, default false
coverImageUrl: "https://..."                  # opcional, recomendado
coverImageAlt: "Texto alt para accesibilidad" # opcional pero importante
---
```

## Categorías

- **historias**: reportajes, crónicas, Behobia, San Silvestre, lo que se siente.
- **guias**: planes de entrenamiento, qué llevar, cómo preparar X carrera.
- **curiosidades**: récords, historia del running, datos que no esperabas.
- **tendencias**: lo que se mueve (zapatillas, rutas, etc.) con contexto,
  sin postureo.

## Relación con el admin

Los posts se suben a Convex y aparecen en `/admin/blog`. Desde ahí puedes:
- Editarlos
- Publicarlos / despublicarlos
- Destacarlos
- Eliminarlos
- Ver el slug, las vistas, el estado de newsletter

El CLI es solo para **crear borradores rápido**. La gestión fina se hace
en la UI del admin.

## Newsletter editorial

El día 1 de cada mes, un cron automático (`newsletter-editorial`) envía
el post más reciente pendiente al email a todos los suscriptores activos
con `editorialEnabled=true`. Cuando se envía, el post se marca con
`newsletterSentAt`, así que no se vuelve a enviar.

Para forzar el envío de un post concreto, márcalo como `featured` o
reordena los posts por fecha. Para saltarlo, desactiva
`editorialEnabled` del suscriptor.

## Variables de entorno

- `NEXT_PUBLIC_CONVEX_URL` — el cliente Convex (obligatorio)
- `RESEND_API_KEY` — para enviar emails reales (sin ella, el cron usa MOCK)

## Archivos

- `scripts/content/generate-post.ts` — genera el esqueleto
- `scripts/content/publish-post.ts` — sube el .md a Convex
- `scripts/content/blog-publisher.ts` — lógica compartida
- `scripts/content/drafts/` — carpeta con borradores (no se commitea)
- `scripts/content/templates/` — plantillas (si quieres copiarlas a mano)
