# Brief: 10 posts piloto SEO (septiembre 2026)

> Lista priorizada de carreras emblemáticas españolas que justifican un post dedicado.
> Cada post conecta con el catálogo (`/carreras/<slug>`), aporta datos propios (VDOT, dorsales),
> y ataca long-tail SEO con demanda real mensurable en Google Trends.

---

## Selección priorizada

Ordenadas por impacto SEO esperado (mezcla de volumen de búsqueda +知名度 + cercanía temporal).

### Tier 1 — Maratones emblemáticas (volumen altísimo, competencia dura)

**1. Zurich Marato Barcelona**
- Slug: `/carreras/zurich-marato-barcelona`
- Keyword principal: `maraton barcelona 2026` (~14.000 búsq/mes)
- Long-tail: `tiempo maraton barcelona`, `recorrido maraton barcelona`, `resultados maraton barcelona 2025`
- Ángulo sugerido: "A qué ritmo salir según tu VDOT — análisis de los tiempos de meta de las últimas 3 ediciones"
- Por qué ahora: Zurich Marato Barcelona es en marzo, ventana SEO ideal (4-5 meses antes).
- Catálogo a enlazar: Zurich Marato + 5 carreras similares (Valencia, Sevilla, Madrid).

**2. Zurich Maraton de Sevilla**
- Slug: `/carreras/zurich-maraton-de-sevilla`
- Keyword: `maraton sevilla 2026` (~7.000 búsq/mes)
- Long-tail: `maratón sevilla recorrido`, `maratón sevilla inscripción`
- Ángulo: "Sevilla en febrero: el maratón más rápido de España. Por qué el clima marca la diferencia."
- Por qué ahora: carrera en febrero, ventana SEO ahora.
- Catálogo: Zurich Sevilla + Maratón Madrid + Maratón Valencia.

**3. Marathon Valencia Trinidad Alfonso**
- Slug: `/carreras/marathon-valencia-trinidad-alfonso` (verificar slug exacto en sitemap)
- Keyword: `maraton valencia 2026` (~12.000 búsq/mes)
- Long-tail: `maratón valencia tiempos`, `maratón valencia recorrido`, `maratón valencia resultados`
- Ángulo: "Valencia, la más rápida del mundo en 2024. Qué dice eso del nivel español."
- Por qué ahora: diciembre 2026. SEO empieza en septiembre.
- Catálogo: Marathon Valencia + 10K Valencia Ibercaja + Carrera de la Mujer Valencia.

### Tier 2 — Carreras con historia / tradiciones

**4. San Silvestre Vallecana**
- Slug: similar a `carrera-popular-silvestre-navideña` (verificar slug real en tu catálogo)
- Keyword: `san silvestre vallecana 2026` (~30.000 búsq/mes en diciembre)
- Long-tail: `san silvestre vallecana inscripción`, `san silvestre vallecana recorrido`, `dorsal san silvestre`
- Ángulo: "La última carrera del año: cómo preparar tu San Silvestre si es tu primera 10K".
- Por qué ahora: empieza a haber búsqueda en septiembre.
- Catálogo: San Silvestre + 5 carreras populares de Madrid.

**5. Behobia-San Sebastián**
- Slug: `behobia-san-sebastian` (verificar en tu catálogo)
- Keyword: `behobia san sebastian 2026` (~10.000 búsq/mes en noviembre)
- Long-tail: `behobia inscripción`, `behobia recorrido`, `behobia tiempos`
- Ángulo: "La Behobia es una carrera popular con trampa. Los primeros 5 km te engañan."
- Por qué ahora: carrera en noviembre, ventana SEO ahora.
- Catálogo: Behobia + 3 carreras del País Vasco + 2 de Navarra.

### Tier 3 — Carreras "top" regionales

**6. Cursa de la Mercè (Barcelona)**
**7. Carrera de la Mujer (multi-ciudad)**
**8. Maratón Madrid**
**9. 10K Valencia Ibercaja**
**10. Cross del Aceite (Andalucía)**

*(Los slugs exactos de cada una los verificará el agente ideador contra el catálogo en Convex.)*

---

## Reglas duras para los 10 posts

1. **No copy-paste del organizador**. Cada post debe tener análisis propio, opinión, o datos únicos (VDOT, dorsales, comparativas).
2. **Cada post enlaza a 3-5 carreras del catálogo** (anchor text descriptivo, NO "haz clic aquí").
3. **Cada post tiene CTA al producto**: "Calcula tu tiempo para [carrera]", "Guarda [carrera] en tu calendario".
4. **Datos marcados [VERIFICAR — fuente: …]** si no se pueden confirmar. El agente NO inventa.
5. **Longitud**: 1.000-1.500 palabras por post. Ni más ni menos.
6. **Voz Manu**: tuteo, sin postureo, datos como celebración. NO tono institucional.
7. **Frontmatter YAML completo** (todos los campos del schema `blogPosts` en Convex).
8. **JSON-LD `Article` + `FAQPage`** con 3-5 preguntas por post (lo que la gente realmente pregunta).

---

## Flujo de ejecución

Para cada uno de los 10 posts, encadenar:

1. **@ideador** → 5 ideas sobre la carrera (ángulo diferencial, fuentes, descartes)
2. **@editor-seo** → convierte las ideas en 1 brief con keywords + outline + internal linking
3. **@redactor-blog** → borrador 800-1.500 palabras con voz Manu
4. **Manu edita y aprueba**
5. **Publicar con `pnpm content:publish <draft> --publish`**

---

## Orden sugerido de producción

No hacer los 10 en paralelo (el agente colapsaría). Mejor **1 post/semana** durante 10 semanas, empezando por:

1. Semana 1: Zurich Marato Barcelona (mayor volumen de búsqueda)
2. Semana 2: Marathon Valencia
3. Semana 3: San Silvestre Vallecana (timing SEO importa)
4. Semana 4: Behobia-San Sebastián
5. Semana 5-10: el resto en orden descendente de prioridad

Cada post lleva ~30 min de Manu (revisar + aprobar) + 5-10 min del agente.

---

## Cómo arrancar mañana

Prompt sugerido para el orchestrator:

```
Esta semana quiero producir 1 post SEO-driven. Datos:
- Carrera elegida del brief 2026-09-20-pilotos-seo.md: <pegar el slug>
- Calendario propio: carreras en próximos 60 días = <lista>
- Posts ya publicados este mes: <lista>

Por favor, encadena:
1. @ideador → dame 5-10 ideas para esta carrera específica (cargadas hacia SEO long-tail)
2. @editor-seo → con esas ideas, dame 1 brief optimizado para SEO
3. Yo elijo el ángulo
4. @redactor-blog → escribe el borrador (800-1.500 palabras, voz Manu, 3-5 internal links al catálogo)
5. Yo edito y apruebo
```

---

## KPIs a medir tras 30 días

- **Posición media en Google** de cada post (debe subir desde "no encontrado" a top 30)
- **Impresiones en GSC** (debería haber algunas, aunque pocas al principio)
- **CTR desde Google** (si es >5%, vale la pena seguir)
- **Tráfico a la ficha de carrera enlazada desde el post** (vía UTM o evento en Convex)

Si tras 30 días estos posts no generan tráfico orgánico, **parar la estrategia** y pivotar a canales con mejor ROI (newsletter, Strava, comunidades).
