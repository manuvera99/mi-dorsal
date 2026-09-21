# Brief operativo: Post #1 — Zurich Marato Barcelona 2026

> Brief listo para pasar al agente `@ideador` el lunes.
> Origen: scripts/content/briefs/2026-09-20-pilotos-seo.md (Tier 1)
> Carrera elegida: Zurich Marato Barcelona (en lugar de Behobia, que no esta en tu catalogo).

---

## Datos de la carrera (de tu sitemap)

- **Slug**: `/carreras/zurich-marato-barcelona`
- **Carrera**: Zurich Marato Barcelona 2026
- **URL ficha**: https://www.mi-dorsal.com/carreras/zurich-marato-barcelona
- **Tipo**: Maraton (42K) + Media + 10K
- **Frecuencia cambio**: weekly (se actualiza segun organizer)
- **Categoria**: Carreras emblematicas / Maratones

## Keywords validadas (Google Suggest sept 2026, en vivo)

- `maraton barcelona 2026` — volumen estimado ~14.000 busq/mes en temporada
- `zeit maraton barcelona` (la gente escribe "zeit" en vez de "zurich" a veces)
- `maraton barcelona recorrido`
- `maraton barcelona fecha`
- `maraton barcelona inscripcion`
- `tiempo meta maraton barcelona`
- `maraton barcelona resultados 2025`

## Long-tail secundario

- `maraton barcelona vs valencia`
- `maraton barcelona mayo 2026`
- `recorrido maraton barcelona 2025`
- `mejores hoteles para maraton barcelona`
- `plan entrenamiento maraton barcelona`

## Volumen estimado del topic

Maratones en general: ~15.000-25.000 busq/mes en temporada (sept-diciembre para carreras de marzo).
"Específicamente Barcelona": ~14.000 busq/mes segun Google Suggest ranking.

## Angulo sugerido

**"Zurich Marato Barcelona 2026: a qué ritmo salir según tu VDOT, basado en los datos de las últimas 3 ediciones"**

- Diferencial vs competencia: Runedia, organizador, runner's world dan "consejos generales" pero NINGUNO cruza VDOT + datos reales de tiempos de meta.
- Datos propios: tu app SÍ calcula predicciones VDOT, este post las pone en contexto con Zurich Barcelona.
- CTA: "Calcula tu tiempo para Zurich Marato Barcelona" → link a /carreras/zurich-marato-barcelona con el widget de pace calculator.

## Internal linking obligatorio (5 carreras relacionadas del catalogo)

- https://www.mi-dorsal.com/carreras/zurich-marato-barcelona (principal)
- https://www.mi-dorsal.com/carreras/zurich-maraton-de-sevilla (comparativa)
- https://www.mi-dorsal.com/carreras/marathon-valencia-trinidad-alfonso (las 3 grandes)
- https://www.mi-dorsal.com/carreras/10k-valencia-ibercaja (10K relacionado)
- https://www.mi-dorsal.com/carreras/mann-filter-maraton-de-zaragoza (otro maraton)

Anchor text natural (NO "haz clic aqui"):
- "Zurich Marato Barcelona"
- "la Zurich de Sevilla"
- "Marathon Valencia"
- "10K Valencia Ibercaja"
- "Mann Filter Maraton de Zaragoza"

## Prompt listo para pegar al agente @ideador

```
Esta semana quiero producir 1 post SEO-driven sobre la Zurich Marato Barcelona 2026.

Carrera elegida: Zurich Marato Barcelona
Slug en mi catalogo: zurich-marato-barcelona
URL ficha: https://www.mi-dorsal.com/carreras/zurich-marato-barcelona
Frecuencia de actualizacion: weekly (segun organizer)

Calendario de carrera: 15 de marzo 2026 (ventana SEO: sept 2025 a feb 2026)
Inscripciones: abiertas desde octubre 2025

Keywords validadas en Google Suggest (sept 2026):
- maraton barcelona 2026
- maraton barcelona recorrido
- maraton barcelona fecha
- maraton barcelona inscripcion
- tiempo meta maraton barcelona

Posts ya publicados este mes en Historias de dorsal: ninguno relevante a maratones

Carreras del catalogo que DEBEN enlazarse desde el post:
- zurich-marato-barcelona (principal)
- zurich-maraton-de-sevilla (comparativa)
- marathon-valencia-trinidad-alfonso (3 grandes)
- 10k-valencia-ibercaja
- mann-filter-maraton-de-zaragoza

Por favor:
1. @ideador → 5-10 ideas para el post, cargadas hacia SEO long-tail, con angulo diferencial vs Runedia/runner's world
2. @editor-seo → convierte esas ideas en 1 brief optimizado
3. Yo elijo el angulo
4. @redactor-blog → escribe el borrador 1000-1500 palabras, voz Manu, tuteo, con VDOT data

NO publiques. Yo apruebo y publico con pnpm content:publish.
```

## Reglas duras (recordatorio para los agentes)

1. **No copy-paste del organizador**. Datos propios (VDOT, dorsales, comparativas).
2. **Cada post enlaza a 5 carreras del catalogo** (anchor descriptivo).
3. **CTA al producto** en cada post.
4. **Marca [VERIFICAR — fuente: …]** los datos que no puedas confirmar.
5. **Longitud**: 1.000-1.500 palabras.
6. **Voz Manu**: tuteo, sin postureo, datos como celebracion.
7. **Frontmatter YAML completo**.
8. **JSON-LD `Article` + `FAQPage`** con 3-5 preguntas.

## KPIs a medir (30 dias desde publicacion)

- Posicion media en Google para "maraton barcelona 2026"
- Impresiones en GSC
- CTR desde Google
- Trafico a la ficha de Zurich Marato Barcelona desde el post

**Si tras 30 dias el post no tiene al menos 50 impresiones en GSC**, parar la estrategia y pivotar.

## Calendario

- Lunes 21 sep: prompt al @ideador
- Martes 22 sep: @editor-seo convierte en brief
- Miercoles 23 sep: tu apruebas angulo, @redactor-blog escribe borrador
- Jueves 24 sep: tu editas y apruebas
- Viernes 25 sep: publicacion con pnpm content:publish
- Lunes 28 sep: revisar que aparece en sitemap y en GSC
- Miercoles 21 oct (30 dias): primer check de KPIs

---

## Que hago YO ahora (en la sesion actual)

Como @ideador / @editor-seo / @redactor-blog son agentes que tienes que abrir tu con `mavis session --agent <nombre>`, yo no puedo invocarlos directamente. Lo que SI hago:

1. Verificar que la carrera Zurich Marato Barcelona tiene los datos SEO suficientes (title, description, JSON-LD) ✓ verificado en sesion anterior
2. Confirmar que el slug del catalogo coincide con el sitemap ✓
3. Preparar el brief con keywords validadas y enlaces reales ✓ (este archivo)
4. Commit + push del brief

**Tu trabajo**:
1. Lunes por la manana, abre `mavis session --agent ideador` (o `@ideador` desde el orchestrator)
2. Pega el prompt de arriba
3. Sigue la cadena ideador → editor-seo → redactor-blog
4. Editas y apruebas el borrador
5. Publicas con `pnpm content:publish scripts/content/drafts/<archivo>.md --publish`
6. Mides KPIs en 30 dias

---

## Pregunta abierta que dejo para ti

He elegido Zurich Marato Barcelona porque **la Behobia no esta en tu catalogo** (solo tienes san-silvestre-badajoz, san-silvestre-chestana, san-silvestre-bruja-alcantarilla, etc.). Confirmame:

1. ¿Zurich Marato Barcelona esta OK como post piloto? o prefieres San Silvestre (muchas variantes en el catalogo) o Marathon Valencia (tambien la tienes)?

Si prefieres Marathon Valencia, el brief es identico, solo cambio:
- Slug: marathon-valencia-trinidad-alfonso
- Keywords: maraton valencia 2026, marathon valencia clasificacion, etc.
- Angulo: comparativa con records mundiales
