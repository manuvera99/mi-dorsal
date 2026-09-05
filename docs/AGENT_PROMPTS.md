# AGENT_PROMPTS — Prompts y órdenes para los agentes del blog mi-dorsal

> Guía de referencia para invocar a los 5 agentes especializados del sistema editorial de **Historias de dorsal** (blog de mi-dorsal). Léelo una vez, tenlo a mano cuando vayas a producir contenido.

---

## Índice rápido

Si necesitas… invoca a… con este prompt…

| Necesitas… | Agente | Prompt mínimo viable |
|---|---|---|
| Ideas frescas de temas | `ideador` | `@ideador dame 5-10 ideas para esta semana` |
| Briefs editoriales con outline + SEO | `editor-seo` | `@editor-seo convierte estas ideas en 3-4 briefs` |
| Borrador de un post | `redactor-blog` | `@redactor-blog escribe el borrador del brief #N` |
| Asunto + copy para el envío mensual | `curator-newsletter` | `@curator-newsletter prepara el envío de este mes` |
| Tweets + carrusel + reel de un post | `repurposing` | `@repurposing convierte este post en 4 formatos` |

**Cadenas comunes** (ver §5):

- **Producir 1 post semanal** → 3 invocaciones encadenadas (ideador → editor-seo → redactor-blog)
- **Envío mensual de newsletter** → 1 invocación (curator-newsletter) + Manu aplica cambios
- **Lanzar un post en redes** → 1 invocación (repurposing) + Manu programa

---

## 1. Cómo invocar a los agentes

### 1.1 Desde el orchestrator (Mavis, yo)

En cualquier mensaje, escribe `@<nombre> <orden>`:

```
@ideador dame 5-10 ideas para esta semana. Calendario clave: Behobia (13 nov).
```

El orchestrator delegará al agente, esperará su resultado, y te lo devolverá con un resumen.

### 1.2 Desde la CLI (sesión dedicada)

```powershell
mavis session --agent ideador
```

Esto abre una sesión dedicada al agente. Útil cuando quieras una conversación larga con un solo agente (ej. iterar sobre un brief).

### 1.3 Encadenar invocaciones

El orchestrator entiende la cadena. Puedes decir:

```
Esta semana quiero producir 1 post sobre la Behobia. Por favor:
1. @ideador → dame 5-10 ideas
2. @editor-seo → convierte esas ideas en 3-4 briefs
3. Yo elijo uno
4. @redactor-blog → escribe el borrador del que yo elija
```

O más compacto:

```
Produce un post sobre la Behobia (ideador → editor-seo → redactor-blog). 
Yo elijo el brief en el medio.
```

---

## 2. Los 5 agentes en detalle

### 🛰 ideador — Scout editorial

**Cuándo invocarlo**: lunes por la mañana (antes de editor-seo) o cuando Manu pida "dame ideas para el blog".

**Qué hace**: escanea el mundo del running (noticias, redes, foros, competencia) y produce 5-10 ideas en `scripts/content/ideas/<fecha>-ideas.md`.

**Qué NO hace**: no produce briefs, no escribe posts, no inventa trending topics.

#### ✅ Prompt bueno

```
@ideador

Necesito un pool de ideas para esta semana (semana del <fecha>).

Contexto:
- Calendario clave próximos 60 días: <lista de carreras grandes>
- Última idea publicada: <link o título>
- Temas que YA descartamos este mes: <lista si la tienes>

Genera 5-10 ideas siguiendo tu workflow habitual. Recuerda:
- Mínimo 2 con ángulo diferencial vs Runnea/Foroatletismo/RW
- Sin duplicar con drafts/ o briefs/ (léelos antes)
- Conecta con el ritual del dorsal (popular, dorsal, línea de meta, avituallamiento)
- Marca los descartes al final (lo que has visto pero no publicas, con razón)
```

#### ❌ Prompt malo

```
@ideador dame ideas para el blog
```

Por qué falla: sin contexto, el agente puede proponer temas genéricos o duplicados.

#### 📦 Entregable esperado

Archivo `scripts/content/ideas/<YYYY-MM-DD>-ideas.md` con:
- Resumen ejecutivo arriba (top 3 + recomendación)
- 5-10 ideas con: hook, por qué AHORA, categoría, ángulo diferencial, fuentes, carreras relacionadas, riesgo
- Lista de descartes al final con razón

---

### ✍ editor-seo — Periodista SEO senior

**Cuándo invocarlo**: martes o miércoles (después de ideador), o cuando Manu ya tenga claras 5-10 ideas.

**Qué hace**: cruza las ideas del ideador con el calendario de carreras propio, prioriza y produce 3-4 briefs con outline + keywords + long tail SEO.

**Qué NO hace**: no escribe contenido, no publica, no decide qué publicar.

#### ✅ Prompt bueno

```
@editor-seo

Aquí tienes el pool de ideas de esta semana: <link o pega las ideas>

Calendario propio relevante:
- Carreras grandes en próximos 60 días: <lista>
- Temas ya en drafts/ o briefs/: <lista>
- Lo que ya publicamos este mes: <lista>

Genera 3-4 briefs siguiendo tu workflow. Puedes:
- Coger ideas del pool
- Añadir 1-2 que no estén si las ves claras (crossover con calendario interno)
- Filtrar si alguna idea del pool no vale la pena (con razón)

Recuerda: long tail SEO, ángulo diferencial, internal linking al catálogo, recomendación
de cuál empezar con razón editorial.
```

#### ❌ Prompt malo

```
@editor-seo haz los briefs de la semana
```

Por qué falla: sin el pool de ideas ni el contexto de calendario, el agente tiene que improvisar y el resultado es genérico.

#### 📦 Entregable esperado

Archivo `scripts/content/briefs/<YYYY-MM-DD>-briefs.md` con:
- Resumen ejecutivo (cuántos briefs, recomendación de cuál empezar, razón)
- 3-4 briefs con: categoría, keywords principal + secundarias, ángulo, outline H2/H3, fuentes, internal linking, longitud objetivo, por qué ahora
- Notas de descarte si has filtrado ideas del pool

---

### 🖊 redactor-blog — Manu con voz de escritor

**Cuándo invocarlo**: miércoles o jueves (después de editor-seo), o cuando Manu ya tenga el brief elegido.

**Qué hace**: escribe el borrador del post en `scripts/content/drafts/<fecha>-<slug>.md` con frontmatter YAML completo, voz de Manu, SEO on-page, internal linking.

**Qué NO hace**: no publica, no inventa datos, no genera placeholders tipo `[insertar cita]`.

#### ✅ Prompt bueno

```
@redactor-blog

Brief elegido: <pega el brief o link>

Contexto adicional:
- Mi experiencia personal con este tema: <qué has vivido tú>
- Datos que NO tienes y quiero verificar: <lista>
- Carreras del catálogo que DEBEN entrar: <lista con slugs>
- Tono/ángulo concreto: <si hay algo especial, ej. "más crudo de lo habitual">

Escribe el borrador siguiendo tu workflow:
- Voz Manu (tuteo, sin postureo, datos como celebración)
- 800-1500 palabras, óptimo 1000-1200
- Hook fuerte en las 2 primeras frases
- 3-5 H2 con desarrollo real
- 1-2 blockquotes con frase destacada
- 2-3 internal links a carreras (anchor text descriptivo)
- 1-2 links externos a fuentes verificables
- Frontmatter YAML completo

Marca [VERIFICAR — fuente: ...] los datos que no puedas confirmar.
```

#### ❌ Prompt malo

```
@redactor-blog escribe un post sobre la Behobia
```

Por qué falla: sin brief, sin contexto personal, sin carreras específicas, el post será genérico y no encajará con el catálogo.

#### 📦 Entregable esperado

Archivo `scripts/content/drafts/<YYYY-MM-DD>-<slug>.md` con:
- Frontmatter YAML completo (todos los campos)
- Contenido 800-1500 palabras
- Estructura: hook → contexto → 3-5 H2 → 1-2 blockquotes → cierre
- 2-3 internal links, 1-2 externos
- Datos marcados [VERIFICAR] si los hay

Después Manu edita y publica con `pnpm content:publish scripts/content/drafts/<archivo>.md --publish`.

---

### 📧 curator-newsletter — Editor de newsletter con ojo para engagement

**Cuándo invocarlo**: día 25 de cada mes (antes del envío del día 1) o cuando Manu lo pida.

**Qué hace**: revisa posts publicados del mes, propone 3 asuntos A/B + preview text + copy del email + segmentación.

**Qué NO hace**: no toca el cron directamente, no decide qué post se envía, no segmenta por datos sensibles.

#### ✅ Prompt bueno

```
@curator-newsletter

Post destacado del mes: <slug o título> — <link al post>

Datos del envío anterior (si los tienes):
- Ratio de apertura: <X%>
- CTR: <Y%>
- Bajas tras el envío: <Z>
- Post con mejor apertura: <slug>
- Post con peor apertura: <slug>

Prepara el envío de este mes con:
- 3 variantes de asunto (directo, pregunta, story-led), ≤60 chars cada uno
- Preview text (≤90 chars) que complementa el asunto
- Copy del email optimizado (≤200 palabras, mobile-first, CTA arriba)
- Sugerencia de segmentación (default + filtros si aplica)
- Calendario: día 1 mes 10:00 UTC, ¿adelantar o atrasar? (con razón)

Recomiéndame cuál de los 3 asuntos usar y por qué.
```

#### ❌ Prompt malo

```
@curator-newsletter qué asunto pongo al email
```

Por qué falla: sin post destacado ni datos de envíos anteriores, el agente tiene que inventar. Y "qué asunto pongo" no es un briefing, es una pregunta de un solo use.

#### 📦 Entregable esperado

Documento markdown (en la respuesta del agente, NO en archivo) con:
- Post destacado + por qué
- Asunto recomendado + 2 alternativas
- Preview text
- Copy del email listo para pegar en `convex/crons/newsletterEditorial.ts`
- Segmentación (default + filtros)
- Calendario y notas

Manu aplica los cambios al cron manualmente.

---

### ♻️ repurposing — Periodista 2.0

**Cuándo invocarlo**: tras publicar un post (después de redactor-blog y aprobación de Manu), o cuando Manu diga "convierte este post en redes".

**Qué hace**: toma un post publicado y produce 5 tweets + 1 carrusel IG + 1 reel script + 1 newsletter corta con ángulo DIFERENTE.

**Qué NO hace**: no publica en redes, no diseña slides, no edita vídeo.

#### ✅ Prompt bueno

```
@repurposing

Post recién publicado: /blog/<slug> — <link al post>

Genera los 4 formatos:
- 5 tweets (≤280 chars cada uno) con gancho + 1 idea cada uno. NO copy-paste del post.
- 1 carrusel IG (8-10 slides) con copy visual-first + caption + 5-8 hashtags específicos
- 1 reel script (30-60s) con hook + 3 puntos + CTA + texto en pantalla + mood de música
- 1 newsletter corta (200 palabras) con ángulo DIFERENTE al post, NO resumen

Sugerencia de orden y timing de publicación (qué primero, qué después, qué día
de la semana).

Cada formato debe ser una pieza nueva, no un recorte.
```

#### ❌ Prompt malo

```
@repurposing conviérteme este post en tweets
```

Por qué falla: pide solo un formato (tweets), no aprovecha el valor de los 4. Y "conviérteme" implica cortar y pegar, que es justo lo que no hay que hacer.

#### 📦 Entregable esperado

Archivo `scripts/content/repurpose/<YYYY-MM-DD>-<slug>-repurpose.md` con:
- 5 tweets numerados
- Carrusel IG: slides numerados + caption + hashtags
- Reel script: hook + setup + 3 puntos + cierre + texto en pantalla + mood
- Newsletter corta
- Sugerencia de orden y timing

Manu programa en sus herramientas (Buffer, TweetDeck, IG nativo, etc.).

---

## 3. Cadenas de invocación comunes

### 3.1 Cadena semanal: producir 1 post (≈5 min de Manu)

Mejor momento: lunes o martes por la mañana.

**Prompt al orchestrator**:

```
Esta semana quiero producir 1 post. Por favor:
1. @ideador → dame 5-10 ideas para esta semana
2. @editor-seo → con esas ideas, dame 3-4 briefs
3. Para Manu: yo elijo un brief y te lo paso
4. @redactor-blog → escribe el borrador del brief que yo elija
5. Para Manu: yo edito y apruebo
6. Yo publico con `pnpm content:publish <archivo> --publish`
```

**Output esperado**: un post publicado en Convex en ~30 min de trabajo real (la mayor parte la hacen los agentes, Manu solo revisa y aprueba).

---

### 3.2 Cadena mensual: enviar newsletter (≈10 min de Manu)

Mejor momento: día 25 del mes.

**Prompt al orchestrator**:

```
Es día 25, prepara el envío de la newsletter de este mes:
1. @curator-newsletter → revisa posts publicados este mes, prepara:
   - 3 asuntos A/B
   - Preview text
   - Copy del email optimizado
   - Sugerencia de segmentación
   - Calendario de envío
2. Para Manu: yo reviso la propuesta, te digo qué asunto usar
3. Yo aplico los cambios a convex/crons/newsletterEditorial.ts
4. El día 1 del mes, el cron envía solo
```

---

### 3.3 Cadena de lanzamiento: post + redes (≈10 min de Manu)

Mejor momento: el día que publicas el post (o el día después).

**Prompt al orchestrator**:

```
Acabo de publicar este post: /blog/<slug> — <link>

@repurposing → genera los 4 formatos (5 tweets, carrusel IG, reel, newsletter
corta) con sugerencia de orden y timing de publicación.

Para Manu: yo programo en Buffer/TweetDeck/IG nativo.
```

---

## 4. Buenas prácticas al dar contexto

Cuando invoques a un agente, incluye SIEMPRE:

1. **El contexto temporal**: "esta semana", "este mes", "el 13 de noviembre"
2. **El estado del proyecto**: "ya publicamos X", "tenemos Y en drafts/", "el calendario tiene Z"
3. **Las restricciones concretas**: "longitud ≤1500 palabras", "tuteo", "sin clickbait", "conecta con el catálogo"
4. **El entregable esperado**: archivo en `scripts/content/...` o documento en la respuesta
5. **Lo que ya sabes tú y el agente no**: tu experiencia personal, datos verificables, carreras específicas

Cuanto más concreto, mejor resultado.

---

## 5. Anti-patrones (qué NO hacer)

### ❌ "Dame ideas para el blog"

Sin contexto, el agente propone genéricos. Siempre incluye fecha, calendario, últimas publicaciones.

### ❌ "Escribe un post sobre X"

Sin brief ni contexto personal, el post será genérico y no encajará. Pasa por editor-seo primero.

### ❌ "Conviérteme este post en tweets"

Pides solo un formato, desperdicias el valor. Pide los 4 con contexto.

### ❌ "Qué asunto pongo al email"

No es briefing, es pregunta de un solo uso. Pide 3 variantes + recomendación.

### ❌ "Publica esto por mí"

Ningún agente publica. Tú apruebas cada paso. Esa es la diferencia entre un medio y un generador de spam.

### ❌ "Hazme SEO para este post"

El SEO se hace en el brief (editor-seo) y en el post (redactor-blog). No es un paso separado.

### ❌ "Mejora este post"

Sin brief original ni razón del cambio, el agente no sabe qué mejorar. Pide algo concreto: "el hook es flojo, dame 3 alternativas" o "la sección 3 se va por las ramas, redúcela".

---

## 6. Troubleshooting

### El agente se va por las ramas

Probablemente diste un prompt demasiado abierto. Recorta:
- "Solo dame 5 ideas sobre X, sin otros temas"
- "Mantén la extensión a 800 palabras, no más"
- "Céntrate en [categoría], ignora las demás"

### El agente propone temas genéricos

Falta contexto. Añade:
- "Sin temas ya cubiertos por Runnea/Foroatletismo/RW"
- "Conecta con el ritual del dorsal"
- "Con al menos 2 con ángulo diferencial"

### El agente inventa datos

El agente debería marcar `[VERIFICAR — fuente: ...]`. Si no lo hace, recuérdale:
- "Marca cualquier dato que no puedas verificar con fuente"
- "Si no estás seguro, di 'no tengo datos, lo verifico' en vez de inventar"

### El agente publica algo sin que yo le dé permiso

No debería pasar. El `Stop when` de cada agente incluye "no publiques". Si pasa, avísame y reviso el agent.md.

### No encuentro la idea perfecta

No la hay. Manu (tú) eliges entre las opciones. Si ninguna convence, pide al ideador que busque con más foco, o sáltate esa semana.

### El redactor no usa mi experiencia personal

Pasa porque no la diste. Incluye en el prompt:
- "Mi experiencia con la Behobia: he corrido 4 veces, mejor marca 1:28"
- "El año pasado me lesioné en el km 18 de una media, úsalo"

### La newsletter no abre

Probablemente el asunto. Pide al curator 3 variantes nuevas. Si sigue sin abrir tras 2-3 envíos, considera cambiar de frecuencia o segmento.

---

## 7. Resumen ejecutivo

5 agentes en cadena:

```
ideador       →  ideas/        (5-10 ideas, lunes)
editor-seo    →  briefs/       (3-4 briefs, martes)
redactor-blog →  drafts/       (borrador, miércoles-jueves)
[Manu publica]                  (viernes)
curator-newsletter → documento  (día 25, asunto + copy)
repurposing   →  repurpose/    (post-publicado, 4 formatos)
```

Todos proponen, ninguno publica. Tú apruebas cada paso.

Para más detalle, los `agent.md` de cada agente están en `C:/Users/Usuario/.minimax/agents/<nombre>/agent.md` y su voz en `PERSONA.md`.
