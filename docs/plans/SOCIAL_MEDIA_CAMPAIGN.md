# Plan de Marketing de Redes Sociales — mi-dorsal

> Documento de campaña para dar a conocer mi-dorsal en redes sociales y atraer tráfico cualificado a **mi-dorsal.com**.
> Período: 180 días (pre-lanzamiento + 24 semanas de campaña activa). Ver §0.1 sobre por qué se dobla el plazo original de 90 días.
> Audiencia objetivo: **corredor popular español, 28-45 años, 3-10 carreras/año**.
> Ejecutor: **1 persona (Manu), sin equipo, en paralelo con el desarrollo de producto** — ver [[user_manu_profile]]. Este documento asume eso en cada estimación de tiempo.
> Fecha de inicio recomendada: la semana que decidas abrir las cuentas.

---

## 0. Por qué este plan existe

**mi-dorsal** ya está en producción desde el 2 sep 2026: web, blog, newsletter, catálogo de carreras (2.761 a 9 sep 2026, creciendo), predicciones VDOT, diplomas PDF. Lo que falta es **comunidad**. Este plan convierte "una web que existe" en "una marca que la gente reconoce en su feed".

### El posicionamiento que defendemos (esto lo usaremos en todo el copy)

- **Strava** = datos de entrenamiento, comparativa social
- **Correbirras** = quedadas y vida social del corredor
- **Runedia** = calendario de carreras
- **mi-dorsal = el ritual del dorsal y el resultado oficial**

No competimos en datos de entrenamiento. Competimos en el hilo invisible que une cada dorsal con la próxima línea de salida. Esa es la guerra que ganamos.

### 0.1 Por qué el plazo pasa de 90 a 180 días

La versión original de este documento (7 sep 2026) asumía 90 días con 6 plataformas activas a 4-7 posts/semana cada una, respondiendo todos los comentarios, más reporte semanal. Sumado al desarrollo de producto en solitario (ver el riesgo "Manu se quema" en `BUSINESS_PLAN.md` §7), eso no es sostenible. Este documento recalibra:

- **Solo 2 plataformas activas desde el día 0**: Instagram y TikTok. Son las críticas (visual, alcance orgánico, demografía correcta) y ninguna necesita guion largo ni edición pesada.
- **X, YouTube, Threads, Bluesky se posponen** a partir del mes 4-6, solo si IG+TikTok van bien y hay tiempo real disponible (ver §3.2).
- **El calendario de 90 días se estira a 180** con la misma cantidad de contenido, publicado más despacio. Preferimos consistencia larga a intensidad corta que se abandona al mes 1 (esto ya lo pedía el propio documento original en su nota final, y aquí se aplica en serio).
- **Frecuencia realista**: 2-3 posts/semana en IG, 3-4 en TikTok (no 4-7). Es lo que cabe en ~3-4h/semana dedicadas a redes, que es lo que puede permitirse alguien desarrollando el producto en paralelo.

### Regla de consistencia (de `docs/history/naming-decisions.md`, `docs/core/brand-voice.md`) que NO se rompe en redes

- **Handles de redes**: `@midorsal` (sin guion, los handles no admiten guion)
- **Hashtags**: `#MiDorsal` (CamelCase para legibilidad)
- **URLs y dominios**: `mi-dorsal.com` (con guion)
- **Copy en pantalla**: `mi-dorsal` (con guion, como el wordmark)
- **Pricing si se menciona Pro**: `2,99 €/mes o 24 €/año` — es el pricing recomendado en `BUSINESS_PLAN.md` §6.4, no el 4,99 €/39 € que hoy está configurado (sin activar) en Clerk. Ver aviso en §5.1: no publicar copy con precio de Pro hasta que el paywall esté activo en producción (`docs/core/billing-subscriptions.md` confirma que hoy está "esqueleto listo, NO activado").

---

## 1. Objetivos (180 días, SMART)

| # | Objetivo | Métrica | Meta modesta (día 90) | Meta modesta (día 180) |
|---|---|---|---|---|
| 1 | Awareness | Seguidores totales agregados (IG + TikTok) | 800 | 2.000 |
| 2 | Awareness | Alcance mensual agregado | 15.000 impresiones | 40.000 |
| 3 | Engagement | Tasa engagement promedio (likes+comments+saves / alcance) | >3% | >4% |
| 4 | Tráfico | Clics a mi-dorsal.com/mes desde redes (UTM) | 500 | 1.500 |
| 5 | Conversión | Registros nuevos en la web (con UTM social) | 80 | 250 |
| 6 | Conversión | Suscriptores newsletter (con UTM social) | 150 | 400 |
| 7 | Comunidad | Menciones UGC / mes (#MiDorsalHistorias) | 10 | 30 |

> **Honestidad sobre los números**: estas metas son la mitad de las del documento original a los mismos 90 días, porque el original asumía 6 plataformas y una intensidad que un solo fundador desarrollando producto no sostiene. Si a día 60 no hay progreso visible (ni en seguidores ni en engagement), el problema es el contenido, no la frecuencia — no compenses publicando más, cambia el ángulo. Si a día 90 superas la meta ambiciosa, es el momento de evaluar abrir X/YouTube (§3.2) o el primer paid (§11).

---

## 2. Audience y buyer persona

### Persona primaria — "Carlos el Popular"

- 32 años, Madrid o Barcelona
- Corre desde hace 3 años, 4-6 carreras/año
- Tiene Strava pero lo abre 1 vez al mes
- Busca carreras en Runedia y en grupos de Telegram
- Apunta sus tiempos en una nota del móvil
- Sigue a corredores en Instagram y TikTok
- **Dolor**: "ningún sitio tiene todos mis resultados juntos"
- **Deseo**: ver su temporada entera, dorsal a dorsal, sin esfuerzo

### Persona secundaria — "Lucía la Debutante"

- 28 años, Valencia
- Va a correr su primera 10K en 4 meses
- Busca consejos, teme no llegar a meta
- Activa en TikTok, mucho Reels de running
- **Dolor**: "no sé qué ritmo llevar / no sé si voy a acabar"
- **Deseo**: que alguien le diga a qué apuntarse, cómo entrenar, qué ponerse

### Persona terciaria (paralela, B2B) — "Roberto el Organizador"

- Director de carrera pequeña-mediana (5K–10K), 200-500 inscritos
- Hoy usa DorsalChip, MySports o Runedia Pro
- Le encantaría tener emails automáticos de resultados
- **Dolor**: "cada carrera es un caos de Excel y emails manuales"
- **Deseo**: olvidarse de la logística y centrarse en los corredores

> Las campañas de este documento (los 180 días completos, §1) van a **Carlos** y **Lucía**. **Roberto** se aborda más adelante con LinkedIn + outreach directo (no en este plan) — ver también la vía de partnerships con organizadores en §11bis.1, que sí toca a Roberto indirectamente pero como canal de adquisición, no como campaña de marca.

---

## 3. Plataformas — dónde abrir cuentas

### 3.1 Fase 1 (día 0, las únicas activas hasta el mes 4-6)

| Plataforma | Handle | Prioridad | Por qué | Formato dominante | Frecuencia realista |
|---|---|---|---|---|---|
| **Instagram** | `@midorsal` | 🔴 CRÍTICA | Visual, masivo en España 25-40, Reels con buen alcance | Reels + carruseles + Stories | 2-3 posts/sem + Stories cuando haya algo que contar (no forzar diario) |
| **TikTok** | `@midorsal` | 🔴 CRÍTICA | Alcance orgánico brutal, nicho running en crecimiento, mismo vídeo sirve para IG Reels | Vídeos cortos 15-30s | 3-4 vídeos/sem |

**Por qué solo estas dos**: un mismo Reel/vídeo corto sirve para IG y TikTok con el mismo archivo (solo cambia el copy/hashtags), así que abrir estas dos no duplica el trabajo de producción — es prácticamente el mismo esfuerzo que abrir una sola. Cualquier plataforma adicional (X, YouTube) sí exige un formato distinto (texto suelto o vídeo largo) y por tanto tiempo de producción propio, que hoy no hay.

### 3.2 Fase 2 (mes 4-6, condicional — solo si Fase 1 va bien y hay tiempo)

| Plataforma | Handle | Por qué esperar | Cuándo abrir |
|---|---|---|---|
| **X / Twitter** | `@midorsal` | Conversación en tiempo real, útil para hashtags de carreras y prensa de running, pero exige presencia casi diaria para funcionar | Cuando IG+TikTok superen la meta modesta del día 90 (§1) y haya 1-2h/semana libres |
| **YouTube** | `@midorsal` | Vídeo largo (5-12 min) es el formato con mayor coste de producción de todos — guion, grabación, edición | Cuando exista ya un banco de contenido corto validado que se pueda "estirar" a formato largo, no antes |
| ~~Threads~~ | (no abrir aún) | Solo tiene sentido si ya hay presencia consolidada en X (republicar cuesta 30s); abrir Threads sin X activo es una cuenta muerta más que mantener | Junto con X, no antes |
| ~~Bluesky~~ | (no abrir) | Nicho aún muy pequeño en España para el segmento corredor popular; revisar en 2027 si cambia el panorama | Sin fecha — reevaluar anualmente |
| ~~LinkedIn~~ | (no abrir) | mi-dorsal no vende a organizadores ("Roberto") todavía — ver §2. El día que se aborde esa vía B2B, sí | Cuando se decida atacar el segmento organizador |
| ~~Facebook~~ | (no abrir) | El corredor popular 28-45 está en Instagram y TikTok, Facebook es demografía 45-65 | Solo si un día se valida lo contrario con datos propios |

> **Regla**: no se abre una plataforma nueva mientras las 2 de Fase 1 no cumplan su meta modesta del período correspondiente. Abrir una cuenta y publicar 2 veces y abandonarla es peor para la marca que no abrirla — una cuenta muerta con el logo de mi-dorsal es la primera impresión de cualquiera que la encuentre por búsqueda.

### Apertura de cuentas (semana -2 a -1) — KIT DE APERTURA

Esto lo haces tú (verificación SMS, email, captcha), pero con este kit queda listo en 1 tarde para las 2 cuentas de Fase 1 (repetir para X/YouTube cuando llegue el momento de §3.2):

#### Para Instagram y TikTok

1. **Email**: crea `redes@mi-dorsal.es` (o usa el de Zoho una vez configurado, ver `docs/history/naming-decisions.md`) — un email solo para redes, separado del personal
2. **Username**: `@midorsal` (sin guion)
3. **Bio corta** (ajustar al límite de caracteres):
   - IG (150 chars): `El hilo que te une a tu dorsal 🏃‍♂️ Predice tu tiempo, recibe resultado oficial y diploma PDF. Sin GPS, sin smartwatch. ↓ mi-dorsal.com`
   - TikTok (80 chars): `El hilo que te une a tu dorsal 🏃‍♂️ mi-dorsal.com`
4. **Foto de perfil**: `public/brand-assets/app-icon-red.png` (ver §4bis.1 para el resto de assets de marca ya diseñados) — recortar a 320×320 si el editor de la plataforma lo pide
5. **Foto de portada**: IG no tiene banner, usar highlights; TikTok no lo necesita.
6. **URL bio**: `https://mi-dorsal.com?utm_source=instagram&utm_medium=social&utm_campaign=launch` (con UTM, ver §10)
7. **Verificación**: cuando esté disponible, reclamar la verificación azul si aplica

#### Orden recomendado de apertura

1. **Instagram** (abre primero)
2. **TikTok** (el mismo día — comparte assets con IG)

---

## 4. Identidad verbal y visual en redes

### Tono (recordatorio de `docs/core/brand-voice.md`)

- **Cercano, con humor sutil de corredor**, sin pasarse
- **Tuteo siempre** ("apúntate", "cruza", "el día D te llega"). Nunca "usted"
- **Frase corta > frase larga**
- **Datos como celebración**, no como reporte ("¡Nuevo PR en 5K!" > "5K PR: 22:34")
- **Sin postureo, sin emojis decorativos, sin jerga B2B**
- **Honestidad radical**: si hay pocos usuarios, decirlo

### Palabras preferidas vs evitadas

| Preferimos | Evitamos |
|---|---|
| Dorsal | Inscripción, registro, ticket |
| Tu tiempo oficial | Tu pace, tu ritmo |
| Tu temporada | Tu plan de entrenamiento |
| Resultado | Performance, métricas |
| Carrera | Evento, competición |
| Línea de salida / cinta de meta | Start / finish line |
| Avituallamiento | Hidratación |
| PR (Personal Record) | Récord personal, best time |
| Club | Grupo, comunidad |

### Paleta visual (de `docs/history/brand-identity.md`)

- **Primario**: `#dc2626` rojo asfalto popular
- **Acento**: `#16a34a` verde
- **Fondo**: `#fafaf9` crema (nunca blanco puro)
- **Texto**: `#0a0a0a` negro suave

> ⚠️ NO migrar a la paleta extendida ("Verano en el Levante") sin rediseño completo. Hasta entonces, rojo `#dc2626` en todos los assets.

### Hashtags — sistema de 3 niveles

**Nivel 1 — Brand (siempre):**
`#MiDorsal`

**Nivel 2 — Nicho (rotar 1-2 por post):**
`#RunningEspaña` · `#CarrerasPopulares` · `#PopularRunner` · `#CorredorPopular` · `#DorsalRunner`

**Nivel 3 — Contexto del post (rotar):**
- Distancia: `#5K` `#10K` `#21K` `#42K` `#Maratón` `#TrailRunning`
- Cultura: `#CintaDeMeta` `#LineaDeSalida` `#Avituallamiento` `#BolsaDelCorredor`
- Engagement: `#MiPrimerMaraton` `#NuevoPR` `#TemporadaDeCarreras` `#DomingoDeCarrera`
- Campañas: `#MiDorsalHistorias` `#DorsalChallenge`

**Regla**: máximo 8-10 hashtags por post, mezclando los 3 niveles. En TikTok y Reels, 3-5 bastan.

---

## 4 bis. Recursos visuales — dónde están y cómo generarlos

Antes de abrir Canva desde cero: **ya existen assets de marca reales**, y el propio producto genera un tipo de imagen que ningún template externo puede igualar en autenticidad. Esta sección conecta ambos con el trabajo de contenido de §6-§7.

### 4bis.1 Assets de marca ya diseñados (usar estos, no rehacer el logo)

| Archivo | Qué es | Uso en redes |
|---|---|---|
| `public/brand-assets/app-icon-red.png` | Icono/isotipo sobre fondo rojo | Foto de perfil IG/TikTok (convertir a 320×320 si hace falta) |
| `public/brand-assets/app-icon-cream.png` | Mismo icono sobre fondo crema | Alternativa cuando el fondo rojo choque con el resto del post |
| `public/brand-assets/logo-horizontal-cream.png` | Wordmark horizontal sobre crema | Watermark en esquina de carruseles/Reels, cabeceras de vídeo |
| `public/brand-assets/wordmark-dark.png` | Wordmark sobre fondo oscuro | Slides oscuras de carrusel, outro de vídeo |
| `public/brand-assets/isotipo-mono-black.png` | Isotipo monocromo | Overlays, marcas de agua sutiles |
| `public/brand-assets/og-image-source.png` | Fuente del OG image | Referencia de composición para nuevos posts "identidad de marca" |
| `public/brand-system-preview.html` | Página de referencia con toda la paleta/tipografía/logo en un sitio | Abrir en el navegador antes de diseñar cualquier template nuevo en Canva, para no reinventar el sistema |

**Regla dura** (de `docs/history/brand-identity.md`): no redibujar el logo ni migrar a la paleta extendida "Verano en el Levante" sin rediseño completo. Todo el contenido de redes usa la paleta actual: rojo `#dc2626`, verde `#16a34a`, fondo crema `#fafaf9` (nunca blanco puro), texto `#0a0a0a`, tipografía Inter (texto) + JetBrains Mono (números/tiempos/dorsales).

### 4bis.2 El generador de contenido más subestimado: las share-cards del producto

mi-dorsal ya genera una imagen de marca (1200×630, estilo "tarjeta de resultado") cada vez que un corredor recibe su resultado oficial: dorsal, tiempo, PR, posición — con la identidad visual ya aplicada. Vive en `lib/share-card/render.tsx` (usa `@vercel/og`/Satori) y hay un script de preview sin necesidad de datos reales en `scripts/example-share-card-html.ts` (genera HTML+PNG vía Playwright para iterar el diseño).

**Por qué esto vale más que un template de Canva para el pilar "Producto en acción" (§5)**:
- Es contenido real de producto, no una maqueta — mucho más creíble como prueba social que un mockup genérico.
- Encaja directamente con el pilar de honestidad radical del tono de marca (§4): "si hay pocos usuarios, decirlo" — mostrar resultados reales (con permiso) en vez de mockups inventados refuerza esa honestidad.
- Reduce trabajo de diseño: para los POST 13 ("Diploma PDF demo") y cualquier futuro post de "resultado real de un corredor", se genera la imagen directamente desde el script en vez de maquetarla en Canva.

**Cómo usarlo para un post**:
1. Ejecuta `scripts/example-share-card-html.ts` (o pide datos reales anonimizados de un resultado ya emitido) para generar el PNG.
2. Pide permiso al corredor antes de publicar su resultado real con nombre — si no hay permiso, usa datos ficticios claramente inventados (nunca presentarlos como reales, ver anti-patrón §12 "no usar testimonios como si fueran reales").
3. El PNG resultante (1200×630) se recorta o se integra como slide de carrusel/fondo de Reel según el formato del post.

### 4bis.3 Cuándo sí usar Canva

Canva (ya en el stack de §11) sigue siendo la herramienta correcta para lo que las share-cards y los assets de marca no cubren: carruseles educativos (§7, POST 9/11/18/20), memes/cultura (POST 12/16), y cualquier composición de texto sobre fondo de color. La regla es: **parte siempre de los assets de `brand-assets/` para logo/colores/tipografía**, no de los templates por defecto de Canva.

### 4bis.4 Prompts para Canva Magic Media (generación de imágenes con IA)

Canva Free incluye **Magic Media** (Apps → Magic Media, o directamente al añadir un elemento y elegir "Generar con IA"). Sirve para fondos/ilustraciones que no dependen de datos reales de producto (a diferencia de las share-cards de §4bis.2, que sí usan datos reales y no se generan con IA).

**Reglas de prompt que valen para cualquier imagen de mi-dorsal** (pégalas mentalmente en cada prompt, o cópialas literal al principio):

- Cierra siempre con el estilo de marca: `estilo fotografía documental, luz natural, sin texto superpuesto, paleta con acentos en rojo #dc2626 y verde #16a34a sobre fondo cálido tipo crema, sin logos de marcas deportivas visibles`
- **Nunca pidas que la IA genere el logo o wordmark de mi-dorsal** — eso se superpone después en Canva con los assets reales de §4bis.1, la IA no lo reproducirá bien y rompería la regla de "no redibujar el logo".
- Especifica siempre `corredor/es popular/es español/es, 30-45 años, complexión y ritmo normales, no élite, sin ropa técnica de marca reconocible` — el sesgo por defecto de estos modelos es generar atletas de élite con equipo de sponsor, que es exactamente lo contrario del posicionamiento de mi-dorsal (§0: "el corredor popular", no Strava/élite).
- Pide formato explícito: `formato cuadrado 1:1` (carrusel IG) / `formato vertical 9:16` (Reel/TikTok/Story).

**Prompt base — Identidad de marca (pilar 1, §5)**

```
Foto de un corredor popular español de unos 35 años cruzando la línea de
meta de una carrera de calle en España, expresión de esfuerzo y alegría
genuina, dorsal visible en el pecho, entorno urbano español reconocible
(sin banderas ni carteles de sponsors legibles), luz de mañana cálida.
Estilo fotografía documental, luz natural, sin texto superpuesto, paleta
con acentos en rojo #dc2626 y verde #16a34a sobre fondo cálido tipo
crema, sin logos de marcas deportivas visibles. Corredor de complexión y
ritmo normales, no élite, sin ropa técnica de marca reconocible.
Formato [cuadrado 1:1 / vertical 9:16].
```

**Prompt base — Educación running (pilar 4, §5)**

```
Ilustración plana (flat illustration) minimalista de [concepto: ej. "un
corredor mirando su reloj de pulsera antes de una carrera" / "una tabla
de ritmos por kilómetro"], estilo icónico simple con 2-3 colores,
paleta rojo #dc2626, verde #16a34a y fondo crema #fafaf9, líneas limpias,
sin texto integrado (el texto se añade después en Canva), sin marcas ni
logos reconocibles. Formato [cuadrado 1:1 / vertical 9:16].
```

**Prompt base — Cultura popular runner (pilar 6, §5)**

```
Foto/ilustración con humor visual sobre [situación: ej. "la cola del
baño en una carrera popular" / "el cajón lleno de dorsales de años
anteriores"], tono cercano y cómico sin ser una caricatura grotesca,
ambientada en una carrera popular española, luz natural, paleta con
acentos en rojo #dc2626 y verde #16a34a sobre fondo crema, sin marcas
deportivas visibles. Formato [cuadrado 1:1 / vertical 9:16].
```

**Nota sobre pilares 2, 3 y 5**: "Producto en acción" (pilar 2) usa mockups de pantalla real de la app o share-cards (§4bis.2), no imágenes generadas por IA — enseñar producto real siempre gana a una ilustración. "Comunidad/UGC" (pilar 3) usa fotos/vídeos aportados por los propios corredores. "Carreras y calendario" (pilar 5) usa datos e imágenes reales de la carrera destacada (fotos oficiales del organizador, con permiso) — nunca una imagen genérica de IA para una carrera concreta y real, sería engañoso.

---

## 5. Pilares de contenido (la rueda)

| # | Pilar | % peso | Objetivo | Formato típico (solo IG + TikTok en Fase 1) |
|---|---|---|---|---|
| 1 | **Identidad de marca** | 20% | Awareness, "qué es mi-dorsal" | Reels cortos, carruseles IG |
| 2 | **Producto en acción** | 25% | Conversión, demos, features | Capturas de pantalla, Reels demo |
| 3 | **Comunidad y UGC** | 20% | Engagement, pertenencia | Reposts, stories, challenges |
| 4 | **Educación running** | 15% | Valor, autoridad | Carruseles IG (nada de vídeo largo hasta que haya YouTube) |
| 5 | **Carreras y calendario** | 10% | Tráfico directo, utilidad | Carruseles, "carrera destacada" |
| 6 | **Cultura popular runner** | 10% | Engagement, shareability | Memes, frases, observaciones, humor |

> **La suma de pilares 1+2+3+5 = 75% de la estrategia**. Educación y cultura son necesarias pero complementarias. Si tuvieras que dejar dos, deja los de cultura y educación y dobla producto y comunidad.

### 5.1 Aviso sobre mencionar Pro/precio en el pilar "Producto en acción"

El paywall de Pro **no está activado en producción** todavía (`docs/core/billing-subscriptions.md`: "esqueleto listo, NO activado" — la tabla `subscriptions` está vacía y toda la app funciona en plan Free). Mientras eso siga así:

- **No publicar** ningún post que mencione "Pro", precio (2,99€ ni 4,99€), ni un feature marcado como exclusivo Pro en `docs/core/billing-subscriptions.md` (Strava OAuth, alertas, planificador, comparativa comunidad, export a calendario externo, coach IA ilimitado).
- **Sí se puede publicar** todo lo que hoy es gratis para cualquier usuario: catálogo, predicciones VDOT, resultado oficial por email, diploma PDF, calendario sin límite, votar/comentar carreras, export ZIP de Strava manual.
- Cuando el paywall se active, el primer post que mencione Pro debe usar **2,99 €/mes o 24 €/año** (pricing recomendado en `BUSINESS_PLAN.md` §6.4), no el 4,99 €/39 € hoy configurado sin activar en Clerk — evita publicar un precio que luego hay que desdecir.

---

## 5 bis. Prompts de texto reutilizables por pilar (para generar captions más allá de los 25 del banco)

Los 25 posts de §7 tienen copy ya escrito, pero se agotan. Esta sección da **un prompt-plantilla por cada uno de los 6 pilares de §5**, pensado para pegar en cualquier LLM (ChatGPT, Claude, Gemini) cuando necesites una caption nueva. Cada prompt ya lleva incorporado el tono de marca — no hace falta repetir instrucciones de estilo cada vez.

### 5bis.0 Prompt maestro de contexto (pégalo siempre antes del prompt del pilar, la primera vez de cada conversación)

```
Vas a escribir copy para redes sociales de mi-dorsal, una app española
para corredores populares (no élite). Reglas de marca, innegociables:

- Tuteo siempre ("apúntate", "cruza"), nunca "usted".
- Frase corta mejor que frase larga. Cero jerga técnica innecesaria.
- Datos como celebración, no como reporte: "¡Nuevo PR en 5K!" en vez de
  "5K PR: 22:34".
- Nada de postureo, nada de emojis decorativos sin significado, nada de
  lenguaje B2B o corporativo.
- Honestidad radical: si el número es pequeño, se dice tal cual (nunca
  inflar cifras de usuarios/seguidores).
- Vocabulario obligatorio: "dorsal" (no inscripción/registro/ticket),
  "tu tiempo oficial" (no tu pace/tu ritmo), "tu temporada" (no tu plan
  de entrenamiento), "resultado" (no performance/métricas), "carrera"
  (no evento/competición), "línea de salida"/"cinta de meta" (no
  start/finish line), "avituallamiento" (no hidratación), "PR" (sí,
  anglicismo adoptado), "club" (no grupo/comunidad).
- Posicionamiento: no competimos en datos de entrenamiento (eso es
  Strava). Competimos en el ritual del dorsal y el resultado oficial.
- Cobertura: toda España, nunca lenguaje que suene solo a Levante/
  Comunidad Valenciana.
- Nunca mencionar "Pro", precio, ni features de pago (ver aviso §5.1
  del documento de campaña) salvo que se indique expresamente lo
  contrario en el prompt del pilar.

Idioma: español de España. Tagline de referencia si hace falta: "El
hilo que te une a tu dorsal".
```

### 5bis.1 Pilar 1 — Identidad de marca

```
Escribe [1 / 3] caption(s) para Instagram sobre [tema concreto: ej.
"por qué mi-dorsal existe" / "qué nos diferencia de Strava" / "la
sensación de cruzar la meta"]. Formato: gancho de 1 línea, 2-4 líneas de
desarrollo, cierre con llamada a la acción suave ("link en bio" o
similar), 3-5 hashtags mezclando #MiDorsal + 1-2 de nicho
(#RunningEspaña, #PopularRunner, #CarrerasPopulares) + 1 de contexto si
aplica. Máximo 80 palabras en el cuerpo del post.
```

### 5bis.2 Pilar 2 — Producto en acción

```
Escribe una caption para Instagram/TikTok que demuestre esta feature
real de mi-dorsal: [feature: ej. "predicción de tiempo con VDOT" /
"diploma PDF automático" / "resultado oficial por email"]. Estructura:
pregunta o problema del corredor en la primera línea, cómo mi-dorsal lo
resuelve en 2-3 líneas concretas (sin exagerar ni prometer de más),
cierre con CTA a probarlo. Recuerda: solo features gratuitas hoy (ver
regla del prompt maestro sobre Pro). 3-5 hashtags.
```

### 5bis.3 Pilar 3 — Comunidad y UGC

```
Escribe una caption para invitar a los seguidores a compartir [algo
concreto: ej. "su dorsal más especial" / "su primera carrera" / "su
peor avituallamiento"] usando #MiDorsalHistorias. Tono cercano, casi de
conversación de grupo de WhatsApp de running, no de campaña corporativa.
Incluye una pregunta directa al final. Máximo 60 palabras.
```

### 5bis.4 Pilar 4 — Educación running

```
Escribe el contenido de un carrusel de Instagram de [5-7] slides que
explique [concepto: ej. "cómo se calcula el VDOT" / "qué es el PR" /
"cómo elegir tu primera 10K"] a un corredor popular sin conocimientos
técnicos previos. Una idea por slide, frases cortas, sin fórmulas
complejas (simplifica sin mentir). Última slide siempre con CTA suave a
mi-dorsal.com. Añade también la caption de acompañamiento (máx. 80
palabras) con 3-5 hashtags.
```

### 5bis.5 Pilar 5 — Carreras y calendario

```
Escribe una caption de "carrera destacada de la semana" para esta
carrera: [nombre, ciudad, fecha, distancia, desnivel si aplica]. Formato
breve: nombre + 3-4 datos clave en líneas separadas con emoji-bullet,
cierre invitando a verla en el catálogo de mi-dorsal.com/carreras. Nunca
inventar datos que no te haya dado — si falta un dato, omítelo en vez
de rellenarlo. Hashtag de la carrera/CCAA + #MiDorsal.
```

### 5bis.6 Pilar 6 — Cultura popular runner

```
Escribe [1 / una lista de 5] observación(es) con humor sobre [situación
de carrera popular: ej. "la cola del baño" / "el cajón de dorsales" /
"el cuñado que dice que antes corría"]. Humor cercano y reconocible para
quien ya ha corrido una popular, nunca burlón ni condescendiente con el
corredor lento o debutante. Cierre opcional invitando a comentar con la
propia anécdota del lector.
```

### 5bis.7 Paso a paso: de "toca publicar" a "post publicado"

Procedimiento único que combina §4bis (imagen) y §5bis.0-6 (texto) para cualquier post del calendario de §6, una vez se agoten los 25 del banco de §7.

1. **Mira qué toca en el calendario editorial** (§8): fecha, plataforma (IG/TikTok), pilar asignado.
2. **Genera el texto**: pega el prompt maestro (§5bis.0) + el prompt del pilar correspondiente (§5bis.1-6) en tu LLM habitual, rellenando los `[corchetes]` con el tema/feature/carrera concreto de ese post. Revisa el resultado contra las reglas de tono (§4) antes de aceptarlo — el LLM puede acertar el formato y fallar el vocabulario (ej. decir "evento" en vez de "carrera").
3. **Genera o elige la imagen**:
   - Si el pilar es **2 (Producto)**: usa una share-card real (§4bis.2) o una captura de pantalla real de la app. No usar IA.
   - Si el pilar es **3 (Comunidad) o 5 (Carreras)**: usa contenido/fotos reales aportadas por el usuario o el organizador, con permiso. No usar IA.
   - Si el pilar es **1, 4 o 6** (Identidad, Educación, Cultura): usa el prompt de imagen correspondiente (§4bis.4) en Canva Magic Media, ajustando el `[concepto/situación]` al tema del post.
4. **Monta el post en Canva**: importa la imagen generada (o la share-card/captura), superpón el logo/wordmark desde `public/brand-assets/` (nunca generado por IA), aplica la paleta de §4 si hay texto en la imagen (carrusel).
5. **Pega el texto** generado en el paso 2 como caption, ajusta el UTM del enlace en bio/descripción según la plantilla de §10.
6. **Revisión final antes de publicar** — checklist rápido:
   - [ ] ¿El vocabulario respeta §4 (dorsal, no inscripción; carrera, no evento)?
   - [ ] ¿Menciona Pro o un precio sin que el paywall esté activo? Si sí, corregir (§5.1)
   - [ ] ¿El copy suena a Levante/Comunidad Valenciana en vez de a toda España?
   - [ ] ¿La imagen respeta la paleta (rojo/verde/crema) y no reinterpreta el logo?
   - [ ] ¿Tiene el UTM correcto para poder medirlo en el reporte de §9?
7. **Publica y registra el post en el Google Sheets del calendario editorial** (§8, columna H = Publicado) para no perder el hilo de qué se ha publicado y cuándo.

---

## 6. Calendario de lanzamiento (12 semanas, día a día)

> Los mismos 25 posts del banco (§7) que el documento original comprimía en 4 semanas se reparten aquí en **12 semanas** (~2 posts nuevos/semana, publicados en IG + TikTok), dejando margen real para desarrollo de producto. Las semanas 13-24 (mes 4-6) se cubren en §6.2 con el mismo ritmo de mantenimiento, sin calendario día a día porque para entonces ya tendrás datos propios para decidir qué repetir.

### Semana -2 a -1: Preparación (silencio en redes)

- [ ] Crear las 2 cuentas de Fase 1: Instagram y TikTok (gris, sin publicar)
- [ ] Configurar bios, fotos, URL (§3.1)
- [ ] Preparar los primeros 6-8 posts con antelación en Canva / Google Sheets (no falta tener los 25 antes de arrancar — con 3 semanas de colchón basta)
- [ ] Diseñar templates para cada pilar (5-6 templates en Canva)
- [ ] Escribir calendario editorial en Google Sheets (1 fila = 1 post, columnas = pilar / plataforma / copy / asset / fecha / UTM)
- [ ] Crear enlaces UTM base: `?utm_source={plataforma}&utm_medium=social&utm_campaign=launch` (ver §10)
- [ ] Tener listo el kit de assets de marca de `public/brand-assets/` (§4bis.1) — no hace falta crear nada nuevo, ya existen

### Semana 0: Lanzamiento (D 0 a D 6)

| Día | Plataforma | Pilar | Post (resumen) |
|---|---|---|---|
| **Lunes D 0** | IG + TikTok | Identidad | **POST 1 + POST 2: Bienvenida** (anuncio oficial, versión IG y versión TikTok) |
| Jueves D 3 | IG + TikTok | Identidad | **POST 4: "¿Qué es mi-dorsal?"** (carrusel + vídeo corto) |
| Domingo D 6 | — | — | Descanso / monitorizar (responder comentarios sí, publicar no) |

> **Nota de numeración**: los números "POST N" de aquí en adelante son los del banco de §7, no un contador secuencial propio — así que saltan (4, 6, 7, 8...) porque los POST 3 y 5 del banco son de Fase 2 (X/YouTube, no se publican aún) y algunos se adaptan de formato. Antes de publicar, ve siempre a §7 con el número exacto citado.

### Semana 1

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 8 | IG + TikTok | Identidad | **POST 5 adaptado: "Por qué creé mi-dorsal"** — en vez del vídeo fundador de 7-10 min pensado para YouTube (aplazado, §3.2), versión corta de 60-90s para Reel/TikTok con los mismos 3 puntos clave |
| Viernes D 11 | IG + TikTok | Identidad | **POST 6: "Sin GPS, sin smartwatch"** (declaración de marca) |

### Semana 2

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 15 | IG + TikTok | Comunidad | **POST 7: Primer UGC** ("¿Cuál es tu dorsal más especial?") |
| Viernes D 18 | IG + TikTok | Identidad | **POST 8: "El hilo que te une a tu dorsal"** (explicar concepto) |

### Semana 3

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 22 | IG + TikTok | Producto | **POST 9: Predicción de tiempos VDOT** (demo) |
| Viernes D 25 | IG | Carreras | **POST 10: Carrera destacada de la semana** |

### Semana 4

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 29 | IG (carrusel) | Educación | **POST 11: "¿Cómo se calcula el tiempo de meta?"** |
| Viernes D 32 | IG + TikTok | Comunidad | Repost del mejor UGC de las 4 semanas + respuesta |
| Sábado D 33 | TikTok | Cultura | **POST 12: Meme / observación** del mundo runner |

> **Checkpoint mes 1**: revisa qué pilar tuvo más engagement (§9) antes de seguir. Si algo claramente no funciona, ajusta ahora, no esperes al mes 3.

### Semana 5

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 36 | IG + TikTok | Producto | **POST 13: Diploma PDF** (mostrar mockup) |
| Viernes D 39 | IG + TikTok | Producto | **POST 14: Tracking de dorsal automático** |

### Semana 6

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 43 | IG | Carreras | Carrera destacada de la semana (repetir formato de POST 10) |
| Viernes D 46 | IG + TikTok | Educación | **POST 15 adaptado: "¿Qué es el PR?"** — versión carrusel/Reel de 45-60s en vez del vídeo de 5 min pensado para YouTube |

### Semana 7

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 50 | TikTok | Cultura | **POST 16: 5 cosas que solo entiende un corredor popular** |
| Viernes D 53 | IG + TikTok | Comunidad | UGC destacado de la semana |

### Semana 8

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 57 | IG + TikTok | Comunidad | **POST 17: UGC reposts** (los mejores del mes) |
| Viernes D 60 | IG | Carreras | **POST 18: "5 carreras que tienes que hacer antes de los 40"** |

> **Checkpoint mes 2**: repite el checkpoint de la semana 4. Con 2 meses de datos ya deberías saber qué pilar dobla y cuál recortas (§9).

### Semana 9

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 64 | IG (carrusel) | Educación | **POST 19 adaptado: "¿Cómo elegir tu primera 10K?"** — carrusel en vez del vídeo YouTube original |
| Viernes D 67 | IG (carrusel) | Educación | **POST 20: "Errores del principiante en la línea de salida"** |

### Semana 10

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 71 | IG + TikTok | Comunidad | **POST 21: Historias de dorsal #MiDorsalHistorias** |
| Viernes D 74 | TikTok | Cultura | Meme / observación (repetir formato de POST 12) |

### Semana 11

| Día | Plataforma | Pilar | Post |
|---|---|---|---|
| Martes D 78 | IG + TikTok | Identidad | **POST 22 adaptado**: "por qué correr una popular" — carrusel en vez del hilo de X original |
| Viernes D 81 | IG + TikTok | Comunidad | Repost UGC de la semana |

### Semana 12: Ajustar y consolidar

- Revisar métricas acumuladas de las 12 semanas (§9) — este es el checkpoint del día 90, contra las metas modestas de §1
- Doblar el pilar que mejor haya funcionado, recortar el que peor
- Evaluar el primer paid test (50€ en IG/TT boost) solo si la base orgánica ya es >500 seguidores (regla de oro en §11)
- Decidir si hay tiempo real para abrir X/YouTube (§3.2) o si se sigue solo con IG+TikTok

### 6.2 Semanas 13-24 (mes 4-6): mantenimiento y, si procede, Fase 2

- Mantener el ritmo de 2-3 posts/sem en IG y 3-4 en TikTok, sin calendario día a día prescrito — a estas alturas ya tienes datos propios de qué pilares y formatos funcionan mejor con tu audiencia real, que pesan más que cualquier plan de partida.
- Repetir el ciclo de banco de posts (§7) con variaciones: carrera destacada semanal, UGC quincenal, 1 pieza de "producto en acción" cada 2 semanas.
- Solo si el checkpoint de la semana 12 fue positivo (metas de §1 cumplidas o superadas) y hay tiempo real disponible: abrir X y/o YouTube según §3.2, reutilizando contenido ya validado (el vídeo fundador largo, los vídeos educativos de PR/10K que aquí se adaptaron a formato corto, se pueden grabar en versión extendida para YouTube con el guion ya probado).
- Checkpoint del día 180: comparar contra las metas ambiciosas de §1 y decidir presupuesto de paid para el segundo semestre (§11).

---

## 7. Banco de posts listos (los 25 primeros, copy completo)

> Marca con `[PLACEHOLDER]` lo que tienes que personalizar (URLs concretas, capturas, etc.).
> Todos los posts respetan la regla de tuteo + frase corta + humor sutil + sin Levante-only.
> El calendario de §6 usa solo IG + TikTok (Fase 1). Los posts pensados originalmente para X o YouTube se marcan **🔜 Fase 2** — quedan aquí de reserva, listos para cuando se abran esas plataformas (§3.2), y no se publican en Fase 1.

---

### POST 1 — Bienvenida IG (lunes D 0) · Pilar: Identidad

**Formato**: Carrusel 5 slides. Slide 1 con dorsal estilizado + tagline. Slides 2-5 con bullets clave. Slide 5 = CTA.

**Caption**:

> 🏃‍♂️ Llevas años corriendo.
> Llevas docenas de dorsales en el cajón.
> Llevas tu tiempo oficial en una nota del móvil.
> Y nadie te lo ha puesto fácil de guardar.
>
> Hasta ahora.
>
> Soy **@midorsal**. El hilo que te une a tu dorsal.
> → Predice tu tiempo antes de la salida
> → Recibe tu resultado oficial al cruzar la meta
> → Diploma PDF en tu buzón
>
> Sin pulseras. Sin GPS. Sin smartwatch.
> Solo tú, tu dorsal y la línea de meta.
>
> 🔗 Link en bio → mi-dorsal.com
>
> #MiDorsal #RunningEspaña #PopularRunner #CarrerasPopulares

---

### POST 2 — Bienvenida TikTok (lunes D 0) · Pilar: Identidad

**Formato**: Vídeo 20-30s, POV cámara rápida

**Guion**:

> [Gancho — 0-3s] Plano detalle: dorsal en mano, temblor.
> VOZ: "Llevo 27 carreras en el cuerpo. Y 0 sitios donde las tenga todas."
>
> [Desarrollo — 3-12s] Pantalla móvil mostrando web/app.
> VOZ: "Por eso monté mi-dorsal. Predice tu tiempo. Recibe resultado oficial. Diploma PDF."
>
> [Cierre — 12-20s] Plano dorsal cruzando cinta de meta (de archivo propio o de carrera con permiso).
> VOZ: "El hilo que te une a tu dorsal. 🔗 mi-dorsal.com"

**Caption TikTok**:

> El hilo que te une a tu dorsal 🏃‍♂️ #MiDorsal #RunningEspaña #PopularRunner

---

### POST 3 — Bienvenida X / Twitter 🔜 Fase 2 · Pilar: Identidad

> 27 carreras. 0 sitios donde las tenga todas.
>
> Por eso monté @midorsal.
>
> → Predice tu tiempo antes de la salida
> → Recibe tu resultado oficial al cruzar la meta
> → Diploma PDF en tu buzón
>
> Sin GPS, sin smartwatch. Solo tú y tu dorsal.
>
> 🔗 mi-dorsal.com
>
> #MiDorsal

---

### POST 4 — "¿Qué es mi-dorsal?" Carrusel IG (martes D 0) · Pilar: Identidad

**Formato**: Carrusel 7 slides. Diseño limpio, una frase por slide.

| Slide | Contenido |
|---|---|
| 1 | ¿Qué es mi-dorsal? |
| 2 | Una web para corredores populares como tú. 🇪🇸 Hecho en España. |
| 3 | 1️⃣ Predice tu tiempo antes de la salida |
| 4 | 2️⃣ Recibe tu resultado oficial por email al cruzar la meta |
| 5 | 3️⃣ Tu diploma PDF descargable, listo para presumir |
| 6 | Sin pulseras. Sin GPS. Sin smartwatch. |
| 7 | 🔗 mi-dorsal.com — link en bio |

**Caption**:

> ¿Qué es mi-dorsal? Te lo cuento en 30 segundos.
>
> 3 cosas que hacemos por ti, sin que tengas que conectar nada:
>
> 1️⃣ Predices tu tiempo antes de la salida (Daniels VDOT, lo que usan los entrenadores)
> 2️⃣ Recibes tu resultado oficial al cruzar la meta — sí, el de la organización, no el del GPS
> 3️⃣ Te llega un diploma PDF al buzón para presumirlo donde quieras
>
> Lo que NO necesitas: pulseras, GPS, smartwatch.
> Solo tú, tu dorsal y la línea de meta. 🏃‍♂️
>
> ¿Te apuntas? → link en bio
>
> #MiDorsal #RunningEspaña #PopularRunner

---

### POST 5 — "Por qué creé mi-dorsal" YouTube 🔜 Fase 2 · Pilar: Identidad

> En Fase 1 (§6, semana 1) este guion se comprime a 60-90s como POST 3 adaptado para Reel/TikTok. La versión larga de abajo se reserva para cuando se abra YouTube.

**Formato**: Vídeo 7-10 min, talking head + capturas de producto

**Título**: "Por qué creé mi-dorsal (la app que me faltaba como corredor popular)"

**Guion sugerido**:
1. **0:00-0:30** Gancho: "Llevo 27 carreras y no tengo un sitio donde estén todas. Y eso me pasaba solo a mí. ¿Te pasa a ti también?"
2. **0:30-2:00** El problema del corredor popular: Strava está bien, pero los resultados oficiales no están. Runedia tiene carreras, pero no te las organiza. No hay nada para ti.
3. **2:00-4:30** La idea: una app que predice tu tiempo, te guarda el resultado oficial y te da un diploma. Sin más.
4. **4:30-6:30** Demo en vivo de mi-dorsal.com: predicciones VDOT, catálogo, ejemplo de diploma
5. **6:30-7:30** Lo que NO es mi-dorsal (no es Strava, no es coach, no es plan de entrenamiento)
6. **7:30-9:00** Qué viene después: app nativa, DorsalSwap, comunidad
7. **9:00-9:30** CTA: suscríbete al canal, apúntate a la newsletter, síguenos en @midorsal

**Descripción**: links a mi-dorsal.com, al blog, a la newsletter, a todas las redes. Timestamps. Hashtags.

---

### POST 6 — "Sin GPS, sin smartwatch" IG (jueves D 0) · Pilar: Identidad

> Adaptado: en Fase 1 se publica como carrusel/post de texto en IG (y su versión visual en TikTok). El copy sirve igual para X cuando se abra en Fase 2.

> Llevamos años oyendo que para correr "en serio" necesitas:
> · GPS
> · Smartwatch
> · Pulsómetro
> · Zapatillas con placa de carbono
>
> No.
>
> Para correr en serio solo necesitas:
> · Unos tenis
> · Un dorsal
> · Las piernas
> · Y ganas
>
> mi-dorsal es para el 99% de corredores que corren con el móvil en el bolsillo y un dorsal en la camiseta.
>
> Sin pulseras. Sin GPS. Sin smartwatch. 🏃‍♂️
> Solo tú, tu dorsal y la línea de meta.
>
> 🔗 mi-dorsal.com
>
> #MiDorsal #PopularRunner

---

### POST 7 — Primer UGC: dorsal más especial (viernes D 0) · Pilar: Comunidad

> Empezamos por aquí.
>
> ¿Cuál es tu dorsal más especial? El que más recuerdas. El que contarías a tus nietos.
>
> 📸 Sube foto del dorsal (o de la carrera) y cuéntamelo con #MiDorsalHistorias
>
> Las 3 mejores las reposting el viernes que viene. 🏃‍♂️

---

### POST 8 — "El hilo que te une a tu dorsal" (lunes D 7) · Pilar: Identidad

> ¿Sabes cuál es la diferencia entre un corredor popular y un atleta?
>
> No es la marca de las zapatillas.
> No es el reloj.
> No es el tiempo.
>
> Es el **dorsal**.
>
> El dorsal es lo que te une a la línea de salida. A la cinta de meta. A la siguiente carrera. A la siguiente temporada.
>
> mi-dorsal existe para que ese hilo no se rompa nunca.
>
> Cada carrera. Cada tiempo. Cada diploma. Guardados para siempre.
>
> 🔗 mi-dorsal.com
>
> #MiDorsal #PopularRunner #DorsalRunner

---

### POST 9 — Predicción VDOT demo (martes D 8) · Pilar: Producto

**Formato**: Reel 30s con pantalla grabada del móvil mostrando la app

**Guion**:

> [Mostrar app en móvil]
> "Llegas a tu próxima 10K y quieres saber a qué ritmo salir."
>
> [Tocar pantalla: introducir tiempo 5K reciente]
> "Mete tu último 5K, en menos de 30 segundos tienes tu predicción de 10K, 21K y maratón."
>
> [Mostrar predicciones]
> "Basado en Daniels VDOT. Lo que usan los entrenadores."
>
> [Cierre]
> "Sin GPS. Sin smartwatch. Solo tú y tu historial."
>
> 🔗 mi-dorsal.com
>
> #MiDorsal #RunningEspaña

**Caption**:

> ¿A qué ritmo tienes que salir en tu próxima 10K?
>
> Mi último 5K: [TIEMPO]
> Mi predicción: [RESULTADO]
>
> ¿Tú ya la sacaste? → link en bio
>
> #MiDorsal #PopularRunner

---

### POST 10 — Carrera destacada de la semana (miércoles D 9) · Pilar: Carreras

**Formato**: Carrusel 3-4 slides. Slide 1 foto + nombre. Slide 2 datos clave. Slide 3 CTA.

> 🏃‍♂️ **CARRERA DE LA SEMANA**
>
> **[Nombre de la carrera]**
> 📍 [Ciudad, CCAA]
> 📅 [Fecha]
> 📏 [Distancia]
> 🏔️ [Desnivel si aplica]
> 🎟️ Inscripción: [link a organizador]
>
> La tienes en nuestro catálogo con toda la info, votaciones 8D y enlace directo a la inscripción.
>
> 🔗 mi-dorsal.com/carreras/[slug]
>
> #MiDorsal #[HashtagCarrera] #[CCAA]

---

### POST 11 — "¿Cómo se calcula el tiempo de meta?" carrusel (jueves D 10) · Pilar: Educación

| Slide | Contenido |
|---|---|
| 1 | ¿Cómo se calcula tu tiempo de meta? |
| 2 | El método Daniels VDOT (el estándar en running) |
| 3 | Paso 1: mete tu mejor marca reciente en una distancia |
| 4 | Paso 2: la fórmula ajusta por distancia y fatiga |
| 5 | Paso 3: obtienes predicción para 5K, 10K, 21K, 42K |
| 6 | Úsalo para fijar tu plan de carrera, no para obsesionarte |
| 7 | 🔗 Prueba tu predicción en mi-dorsal.com |

**Caption**:

> ¿A qué ritmo deberías salir en tu próxima carrera?
>
> El método Daniels VDOT es lo que usan los entrenadores profesionales para predecir tiempos. Lo hemos metido en mi-dorsal.
>
> Solo necesitas:
> · Tu mejor marca en una distancia (5K, 10K, 21K…)
> · La distancia de la carrera objetivo
>
> En 30 segundos tienes tu ritmo objetivo. Sin GPS, sin smartwatch, sin apps de pago.
>
> 🔗 mi-dorsal.com
>
> #MiDorsal #RunningEspaña

---

### POST 12 — Meme / observación cultural (sábado D 12) · Pilar: Cultura

> Tu cuñado: "Yo antes corría"
>
> Tú, mirando el cajón lleno de dorsales: "Antes, dice…"

O alternativa:

> Cosas que solo pasan en una carrera popular:
> 1. Llegas 1h antes y el parking ya está lleno
> 2. La cola del baño es más larga que la propia carrera
> 3. En el km 8 recuerdas por qué te apuntaste
> 4. Cruzar la meta con 3 min más de tu mejor marca y sentirte MVP
>
> #MiDorsal #PopularRunner

---

### POST 13 — Diploma PDF demo (lunes D 14) · Pilar: Producto

**Formato**: Reel o carrusel mostrando mockup del diploma real generado

**Caption**:

> ¿Has cruzado alguna vez la meta y no has tenido ni una foto que lo demuestre?
>
> Con mi-dorsal, cuando cruzas la meta, te llega al buzón:
>
> 📄 Tu diploma PDF oficial
> ⏱️ Tu tiempo oficial (el de la organización, no el del GPS)
> 📊 Tu posición en la general y en tu categoría
>
> Listo para imprimir, para enmarcar o para enviar a tu madre.
>
> 🔗 mi-dorsal.com
>
> #MiDorsal #PopularRunner #CintaDeMeta

---

### POST 14 — Tracking de dorsal automático (martes D 15) · Pilar: Producto

> ¿Te has apuntado a una carrera y luego no sabes ni dónde quedó tu dorsal?
>
> A mí me pasaba siempre.
>
> Por eso en mi-dorsal, cuando te apuntas a una carrera, el dorsal se guarda solo en tu perfil. Sin tocar nada.
>
> Y el día de la carrera, cuando la organización publica resultados, te llega el resultado oficial a tu buzón. Con tu diploma PDF.
>
> Solo te tienes que preocupar de correr. 🏃‍♂️
>
> 🔗 mi-dorsal.com
>
> #MiDorsal #CarrerasPopulares

---

### POST 15 — "¿Qué es el PR?" YouTube 🔜 Fase 2 · Pilar: Educación

> Adaptado: en Fase 1 (§6, semana 6) se publica como carrusel o Reel de 45-60s con la misma idea comprimida. La versión larga de abajo se reserva para YouTube.

**Formato**: Vídeo 5-7 min

**Título**: "PR: qué es y por qué te debería importar más que tu pace"

**Guion resumido**: explicar qué es el PR (Personal Record), por qué es mejor celebrar el PR que el pace, cómo mi-dorsal lo trackea automáticamente. CTA a la app.

---

### POST 16 — "5 cosas que solo entiende un popular" (sábado D 19) · Pilar: Cultura

> 5 cosas que solo entiende un corredor popular:
>
> 1. Que el avituallamiento del km 8 sabe mejor que cualquier restaurante Michelin
> 2. Que "solo 5K" es una frase que mientes a todo el mundo
> 3. Que la bolsa del corredor vale más que la inscripción
> 4. Que un PR es un PR, no importa los minutos
> 5. Que el dorsal es el souvenir que no se tira nunca
>
> ¿Falta alguna? Dímela en comentarios 👇
>
> #MiDorsal #PopularRunner

---

### POST 17 — UGC reposts (lunes D 21) · Pilar: Comunidad

> Vuestras historias de dorsal nos tienen el corazón en un puño. ❤️
>
> Esta semana reposting a @[usuario1] @[usuario2] @[usuario3] con sus dorsales más especiales.
>
> ¿Te has perdido la campaña? Sube la tuya con #MiDorsalHistorias y la vemos.
>
> #MiDorsal #PopularRunner

---

### POST 18 — "5 carreras que tienes que hacer antes de los 40" (martes D 22) · Pilar: Carreras

**Formato**: Carrusel 5 slides, una carrera por slide + slide final CTA

> 5 carreras que tienes que hacer antes de los 40:
>
> 1. Behobia-San Sebastián (20K, noviembre) — la popular por excelencia
> 2. San Silvestre Vallecana (10K, 31 dic) — para cerrar el año corriendo
> 3. Maratón de Valencia (42K, diciembre) — la mejor organización de España
> 4. Cursa de la Mercè (10K, septiembre, Barcelona) — la fiesta del running catalán
> 5. Carrera de la Mujer (5-10K, varias ciudades) — para correr con quien más quieres
>
> ¿Cuál te falta? Dímelo en comentarios 👇
>
> Todas en nuestro catálogo → mi-dorsal.com
>
> #MiDorsal #RunningEspaña

---

### POST 19 — "¿Cómo elegir tu primera 10K?" YouTube 🔜 Fase 2 · Pilar: Educación

> Adaptado: en Fase 1 (§6, semana 9) se publica como carrusel IG con los mismos 5 criterios. La versión larga de abajo se reserva para YouTube.

**Formato**: Vídeo 6-8 min, presentación + capturas

**Título**: "Tu primera 10K: cómo elegirla sin morir en el intento"

**Guion**: 5 criterios (fecha, perfil, distancia de casa, popularidad, avituallamiento) + 3 recomendaciones concretas + CTA mi-dorsal.com.

---

### POST 20 — "Errores del principiante en la línea de salida" (jueves D 24) · Pilar: Educación

| Slide | Contenido |
|---|---|
| 1 | 5 errores del principiante en la línea de salida |
| 2 | 1. Salir demasiado rápido. Siempre. |
| 3 | 2. No mirar el perfil antes (las cuestas no avisan) |
| 4 | 3. Hidratarse mal: ni mucho ni poco, en los puntos correctos |
| 5 | 4. Ponerse ropa nueva el día D (no, en serio, no) |
| 6 | 5. No tener un objetivo realista. Un PR no sale en cada carrera. |
| 7 | ¿Y si pruebas la predicción de mi-dorsal antes? → mi-dorsal.com |

---

### POST 21 — Historias de dorsal #MiDorsalHistorias (viernes D 25) · Pilar: Comunidad

> #MiDorsalHistorias de esta semana:
>
> 📖 @usuario1: "Mi dorsal 247 de la Behobia 2019. La primera vez que mi hijo me vio cruzar la meta. No he llorado más en público desde entonces."
>
> 📖 @usuario2: "Dorsal 1.024 de la Carrera de la Mujer. La primera que corrí después de ser madre. 47 minutos que valen un doctorado."
>
> 📖 @usuario3: "Maratón de Valencia 2023. Dorsal 8.420. Mi primer maratón, 4:32, llegué muerta y volveré a salir igual."
>
> ¿La tuya? → #MiDorsalHistorias
>
> #MiDorsal #PopularRunner

---

### POST 22 — "Por qué todo el mundo debería correr una popular" (semana 11) · Pilar: Identidad

> Adaptado: en Fase 1 (§6, semana 11) los mismos 6 puntos se publican como carrusel de 6-7 slides en IG (uno por punto) en vez de hilo de X. El formato hilo original se reserva para cuando se abra X en Fase 2 — el texto de abajo sirve para ambos, solo cambia el empaquetado.

> 🧵 Hilo: por qué todo el mundo debería correr una carrera popular al menos una vez en la vida.
>
> 1/ Correr solo está bien. Pero correr con 5.000 personas que sienten lo mismo que tú es otra cosa.
>
> 2/ No necesitas ser rápido. Necesitas ser popular. (El nombre no es casualidad.)
>
> 3/ El avituallamiento del km 8 te reconcilia con la vida.
>
> 4/ La cinta de meta no entiende de PR. Entra cualquiera que haya entrenado.
>
> 5/ Te vuelves a casa con un dorsal, una medalla y un grupo de WhatsApp nuevo.
>
> 6/ Y al año siguiente, sin saber por qué, te apuntas otra.
>
> Eso es el running popular. Y por eso existe @midorsal.
>
> 🔗 mi-dorsal.com

---

### POST 23 — Domingo de carrera (recurrente, fines de semana de carrera) · Pilar: Comunidad

> Domingo de carrera. ☀️
>
> Si estás en la línea de salida: mucha mierda, pero la buena.
>
> Si estás en casa todavía en la cama: ya sabes qué app abrir.
>
> 🏃‍♂️🔗 mi-dorsal.com
>
> #MiDorsal #DomingoDeCarrera

---

### POST 24 — Behind the scenes (semana 4+) · Pilar: Identidad

**Formato**: Reel/TikTok mostrando cómo se hace el producto (curación de carreras, scrapers, etc.)

**Guion**:

> "¿De dónde salen los datos de las carreras de mi-dorsal?"
>
> [Mostrar pantalla con terminal, scrapers, datos entrando]
> "Esto es trabajo diario. Cada semana revisamos cientos de carreras, hablamos con organizadores y mantenemos el catálogo actualizado para que tú solo tengas que correr."
>
> [Cierre]
> "Hecho con cariño en 🇪🇸. 🔗 mi-dorsal.com"

---

### POST 25 — Call to action newsletter (semana 4+) · Pilar: Producto

> Corregido (9 sep 2026): la caption original decía "todos los viernes" — la cadencia real del cron `newsletter-editorial` es **1 vez al mes** (día 1, ver `docs/core/blog-newsletter.md`), no semanal. `weekly-digest` se eliminó del código por decisión explícita de no enviar un email semanal recurrente. El copy de abajo ya refleja la cadencia real.

> Si has llegado hasta aquí, esto es para ti. 👇
>
> Una vez al mes te envío un email con:
> 📖 La mejor historia nueva del blog "Historias de dorsal"
> 🏃 Carreras destacadas que no te puedes perder
> 💡 Un consejo rápido de running
>
> Sin spam. Sin postureo. Solo lo que un corredor popular quiere saber.
>
> 🔗 mi-dorsal.com/newsletter
>
> #MiDorsal #PopularRunner

---

## 8. Calendario editorial — cómo organizarte

### Google Sheets con esta estructura

| Columna | Contenido |
|---|---|
| A | Fecha de publicación |
| B | Plataforma (IG / TikTok — X / YT / Threads / Bluesky solo si se abre Fase 2, §3.2) |
| C | Pilar (1-6 de §5) |
| D | Formato (Reel / Carrusel / Post simple) |
| E | Copy (pegar el texto del banco de posts) |
| F | Asset (enlace al archivo en Canva/Drive) |
| G | URL con UTM |
| H | Estado (Borrador / Programado / Publicado) |
| I | Métricas 24h (alcance, likes, comments, saves, shares, clics) |
| J | Métricas 7d |
| K | Notas (qué funcionó, qué repetir, qué evitar) |

### Programación

- **Instagram**: usa **Meta Business Suite** (gratis, programar 30 días antes) o **Later** plan free (5 posts/sem)
- **TikTok**: subir directamente o **Metricool** (gratis, programar)
- Cuando se abra Fase 2 (§3.2): YouTube se programa desde su propio panel; X directo o con Buffer free.

**Regla**: deja las 3 primeras semanas sin programar y publica manual. Eso te obliga a mirar las reacciones, responder, y entender el ritmo. A partir de la semana 4 ya puedes programar con 1 semana de antelación.

---

## 9. KPIs y métricas (cómo medimos el éxito)

### Métricas de awareness (¿nos ven?)

- **Alcance único** por plataforma (semanal)
- **Impresiones** totales
- **Crecimiento de seguidores** (seguidores netos / semana)
- **Menciones de marca** (#MiDorsal, menciones en comentarios, tags)

### Métricas de engagement (¿les importamos?)

- **Tasa de engagement** = (likes + comments + saves + shares) / alcance × 100. Objetivo >3% (día 90), >4% (día 180) — ver §1
- **Saves** (IG): indicador oro de contenido valioso. Si un post tiene muchos saves, haz más como ese
- **Comments**: responde TODO el primer mes; a partir de ahí, al menos los que pidan algo o generen conversación real
- **Watch time** (TikTok): si >50% de la duración del vídeo, el algoritmo premia

### Métricas de tráfico (¿vienen a la web?)

- **Clics en enlace bio** (IG)
- **Tráfico por UTM** en Google Analytics: filtro por `utm_campaign=launch` (semanas 0-12) y luego `utm_campaign=always-on`
- **Tasa de clic en CTA** (CTR por post): objetivo >1,5%

### Métricas de conversión (¿se apuntan?)

- **Registros nuevos en la web** (con UTM source)
- **Suscripciones a la newsletter** (con UTM source)
- **Descargas del diploma PDF** (si implementas tracking)

### Reporte (viernes cada 2 semanas, 20-30 min)

Con solo 2 plataformas activas, un reporte quincenal (en vez de semanal) es suficiente para tomar decisiones y libera tiempo real. Rellena esta tabla en tu Google Sheets:

| Plataforma | Posts | Alcance | Engagement | Clics web | Registros | Notas |
|---|---|---|---|---|---|---|
| Instagram | | | | | | |
| TikTok | | | | | | |
| **TOTAL** | | | | | | |

Cuando se abra Fase 2 (§3.2), añade una fila por cada plataforma nueva.

---

## 10. UTMs y tracking (cómo saber de dónde viene cada visita)

### Plantilla base de UTM

`https://mi-dorsal.com?utm_source={plataforma}&utm_medium=social&utm_campaign={campaña}&utm_content={post_id}`

### Ejemplos concretos

- Post de bienvenida IG: `?utm_source=instagram&utm_medium=social&utm_campaign=launch&utm_content=post1-bienvenida`
- Vídeo TikTok: `?utm_source=tiktok&utm_medium=social&utm_campaign=launch&utm_content=post2-bienvenida`
- Carrera destacada IG: `?utm_source=instagram&utm_medium=social&utm_campaign=carrera-semana&utm_content=post10-behobia`
- Newsletter CTA: `?utm_source=instagram&utm_medium=social&utm_campaign=always-on&utm_content=post25-newsletter`

### Convenciones

- `utm_source`: `instagram`, `tiktok` en Fase 1; `twitter` (no `x`), `youtube`, `threads`, `bluesky` se añaden si se abre Fase 2 (§3.2)
- `utm_medium`: siempre `social`
- `utm_campaign`: `launch` (semanas 0-12), `carrera-semana` (recurrente), `newsletter-cta` (recurrente), `ugc` (comunidad), `always-on` (resto)
- `utm_content`: identificador del post (`post1-bienvenida`, etc.)

### Cómo leerlo en Google Analytics

1. Informes → Adquisición → Adquisición de tráfico
2. Añadir dimensión secundaria: `Source / Medium`
3. Filtrar: `Medium = social` para ver todo lo de redes
4. Añadir dimensión `Campaign` para desglosar por campaña

---

## 11. Herramientas y presupuesto

### Stack gratuito (mes 1-3)

| Herramienta | Uso | Coste |
|---|---|---|
| **Canva Free** | Diseño de posts, carruseles, mockups | 0 € |
| **CapCut Free** | Edición de vídeo para TikTok/Reels | 0 € |
| **Meta Business Suite** | Programar IG | 0 € |
| **Later Free** | Programar IG + TikTok (5 posts/sem) | 0 € |
| **Metricool Free** | Alternativa española, programar + analítica | 0 € |
| **Google Sheets** | Calendario editorial + reporte quincenal | 0 € |
| **Google Analytics 4** | Tracking de UTMs | 0 € |
| **Pixlr / Photopea** | Ediciones rápidas de imagen sin Photoshop | 0 € |

### Stack de pago (si se justifica a partir del mes 3-4)

| Herramienta | Uso | Coste/mes |
|---|---|---|
| Canva Pro | Templates premium, brand kit, sin marca de agua | 13 € |
| CapCut Pro | Edición avanzada de vídeo | 8 € |
| Metricool Pro | Analítica de competidores, mejores reportes | 12 € |

**Total opcional**: ~33 €/mes. Solo si lo justifican los datos. Cuando se abra Fase 2 (§3.2), se puede sumar Buffer Free (X, 3 canales) sin coste.

---

## 11 bis. Adquisición de tráfico más allá de las redes propias

Las redes sociales (§1-§10) construyen **marca y audiencia propia**, pero no son la única ni necesariamente la mejor fuente de tráfico a corto plazo para un dominio de días de vida. Este capítulo cubre canales adicionales, incluida publicidad de pago, con foco en dónde el euro rinde más para mi-dorsal específicamente.

### 11bis.1 Canales gratuitos con más probabilidad de tráfico cualificado a corto plazo

| Canal | Por qué funciona para mi-dorsal | Esfuerzo | Cuándo |
|---|---|---|---|
| **Partnerships con organizadores de carreras** | Un enlace desde la página de inscripción/resultados de una carrera es tráfico de máxima intención (alguien ya inscrito) y gratis. Es la palanca más infravalorada de `MONETIZATION_PLAN.md` y `BUSINESS_PLAN.md` — ninguno de los dos la desarrolla. | Medio (outreach 1 a 1 por email/teléfono) | Desde mes 1, en paralelo a redes — no compite por el mismo tiempo (es outreach, no contenido) |
| **Comunidades de nicho existentes** (grupos de Telegram/WhatsApp de running, Foroatletismo, subreddits de running en español) | Tu Carlos/Lucía ya está ahí. Cero coste de construir audiencia desde cero. | Bajo, pero cuidado con reglas anti-autopromo de cada comunidad — aportar valor antes de enlazar | Desde mes 1 |
| **SEO de contenidos** (ya cubierto en `MONETIZATION_PLAN.md` Q1-Q2) | El activo más grande a largo plazo (2.761 carreras indexadas), pero un dominio de días de vida tarda típicamente 6-12 meses en generar volumen relevante en Google, no las 5-10k visitas/mes que proyecta el plan de monetización para el mes 1-3 | Ya en marcha vía catálogo; el trabajo adicional es contenido editorial (guías, blog) | Resultados reales esperables a partir de mes 6-12, no antes |
| **Prensa/medios de running** (Sportlife, Runner's World ES, blogs de running) | PR gratis con el ángulo "app española gratis hecha por un corredor popular para corredores populares" | Bajo-medio (unos emails bien dirigidos) | Cuando haya algo que contar: lanzamiento, primeros 1.000 usuarios, o una historia de producto genuina |

### 11bis.2 ¿Se puede pagar por publicidad? Sí, con esta prioridad

**Regla de oro (se mantiene del documento original)**: no gastar un euro en paid hasta tener 500 seguidores propios y al menos 2 posts con >5% de engagement — sin eso no sabes qué contenido amplificar, y sin ingresos activados (Pro sin activar, ver §5.1) cualquier euro sale directamente del bolsillo de Manu.

Cuando llegue ese momento (probablemente semana 12 en adelante, checkpoint de §6):

1. **Google Ads Search, no Meta/TikTok Ads, es el primer euro que gastaría.** Captura intención ya existente ("calendario carreras [ciudad] 2026", "cuándo es la maratón de X") en vez de fabricar awareness desde cero, y en este nicho el CPC suele ser bajo por poca competencia pagando esas keywords. Presupuesto inicial de prueba: 50-100 €/mes en 5-10 keywords de cola larga sobre carreras/ciudades concretas.
2. **Boost orgánico de IG/TikTok** (50-100 €/mes) para amplificar los 2-3 mejores posts del mes — solo una vez cumplida la regla de oro.
3. **Microinfluencers** (100-200 € por collab con 2-3 corredores populares de 1k-10k seguidores, NO grandes influencers) — a partir de 1.000 seguidores propios, como ya indicaba el roadmap (§13).
4. **Patrocinio de newsletters de running de nicho** (50-150 € por mención) — más barato que ads y más cualificado.

**Por qué Search antes que awareness social**: con presupuesto limitado y cero ingresos activados todavía, cada euro debe ir donde ya hay demanda expresada (alguien buscando activamente una carrera) en vez de donde hay que crear demanda desde cero (un anuncio interrumpiendo un feed). El paid en Meta/TikTok tiene sentido más adelante, cuando ya haya contenido validado que amplificar y alguna pata de ingresos generando caja (Pro activo, o AdSense aprobado).

---

## 12. Riesgos y anti-patrones (lo que NO hacer)

### Anti-patrones de marca

1. **No usar copy que limite a Levante/Valencia/Alicante/Murcia**. mi-dorsal cubre toda España desde sept 2026 (`docs/core/anti-patterns.md`, AGENTS.md §1)
2. **No usar testimonios como si fueran reales** sin verificar. La home tiene disclaimer explícito (`docs/core/anti-patterns.md`, `docs/core/home-structure.md`)
3. **No usar la foto de un dorsal genérico de stock** — solo contenido propio o de corredores reales con permiso
4. **No usar la palabra "evento" o "competición"** — son las que dice tu cuñado, no el corredor popular (`docs/core/brand-voice.md`)
5. **No usar "amateur"** — suena despectivo. Es "popular" (`docs/history/domain-glossary.md`)
6. **No usar "usted"** nunca. Tuteo siempre
7. **No inflar números** — si hay 47 usuarios, di "47 corredores ya". La honestidad convierte mejor

### Anti-patrones de plataforma

1. **No publicar lo mismo en IG y TikTok sin adaptar** — el vídeo puede compartirse, pero el copy/hashtags de cada uno tiene su gramática
2. **No abrir X, YouTube, Threads o Bluesky "porque sí"** — cada plataforma nueva es tiempo de producción propio que hoy no hay (§3.2). Abrirla y abandonarla es peor que no abrirla
3. **No obsesionarte con los seguidores** — 1.000 fans que abren tu email > 10.000 followers anónimos
4. **No comprar seguidores** — mata el engagement, hace que el algoritmo te castigue
5. **No ser un broadcaster** — las redes son conversación. Responde TODO el primer mes, idealmente siempre
6. **No usar hashtags genéricos sin contexto** — #fitness y #running son demasiado amplios, no te ven los populares
7. **No publicar 3 posts el lunes y nada el resto de la semana** — la consistencia > la intensidad
8. **No dejar de publicar a los 2 meses sin resultados** — los algoritmos necesitan 8-12 semanas para entenderte, y este plan ya asume una cadencia sostenible a propósito (§0.1)

### Anti-patrones de ejecución

1. **No abrir las cuentas y empezar a publicar el mismo día** — prepara todo con 2 semanas de antelación
2. **No saltarte el kit de apertura** (bio, foto, URL) — una cuenta sin bio y sin foto es una cuenta muerta
3. **No olvidarte de los UTMs** — sin UTMs, no sabrás qué plataforma convierte y cuál solo da likes
4. **No usar el email personal para las cuentas** — crea uno dedicado, separado
5. **No mezclar cuentas personales con la cuenta de marca** — ni un follow de tu cuñado desde la cuenta de @midorsal
6. **No publicar copy con precio de Pro (2,99€ o 4,99€) mientras el paywall no esté activo en producción** — ver §5.1
7. **No dejar que redes compitan por tiempo con bugs de producción en curso** — si hay un incidente activo (como el pipeline de diplomas roto y arreglado el 9 sep 2026), el post programado espera un día. La app en producción manda sobre el calendario editorial

---

## 13. Roadmap 180 días

### D -14 a D -1 — Preparación

- [ ] Crear `redes@mi-dorsal.es` (o configurar Zoho según `docs/history/naming-decisions.md`)
- [ ] Abrir cuentas en **IG y TikTok únicamente** (§3.1) con handle `@midorsal`
- [ ] Configurar bios, foto, URL en ambas
- [ ] Preparar los primeros 6-8 posts con copy (POST 1, 2, 4, 5 adaptado, 6, 7 de §7 — los de semana 0-1 del calendario de §6)
- [ ] Diseñar 5-6 templates en Canva (1 por pilar + welcome)
- [ ] Configurar Google Sheets del calendario editorial
- [ ] Configurar UTMs en `mi-dorsal.com` para los enlaces base
- [ ] Verificar Google Analytics 4 que recibe UTMs correctamente

### D 0 a D 30 (semanas 0-4) — Lanzamiento y construcción de base

- [ ] Publicar según calendario §6, semanas 0-4 (~9 posts adaptados)
- [ ] Responder TODOS los comentarios
- [ ] Reporte quincenal (30 min, no semanal — ver §9)
- [ ] Checkpoint día 30 (fin de semana 4, §6): revisar qué pilar funciona y ajustar
- [ ] Si el engagement de un pilar es >2x la media → doblarlo
- [ ] Si el engagement de un pilar es <0,5x la media → eliminarlo o reformularlo

### D 30 a D 60 (semanas 5-8) — Crecimiento y ajuste

- [ ] Empezar a explorar los canales gratuitos de §11bis.1 (partnerships con organizadores, comunidades de nicho) — no compiten por el mismo tiempo que el contenido de redes
- [ ] Empezar a programar contenido con 1 semana de antelación (ya no publicar 100% manual)
- [ ] Checkpoint día 60 (fin de semana 8, §6)

### D 60 a D 90 (semanas 9-12) — Consolidación del primer trimestre

- [ ] Lanzar primer reto/challenge UGC (#MiDorsalHistorias) si no se ha hecho ya
- [ ] Checkpoint día 90 (fin de semana 12, §6): comparar contra metas modestas de §1
- [ ] Si se cumplen: evaluar primer paid — Google Ads Search primero (§11bis.2), no Meta/TikTok
- [ ] Si se cumplen y hay tiempo real: valorar abrir X y/o YouTube (§3.2) para el segundo trimestre
- [ ] Si no se cumplen: no añadir más plataformas ni más frecuencia — revisar el contenido, no la cantidad

### D 90 a D 180 (mes 4-6) — Mantenimiento, Fase 2 condicional, primer paid real

- [ ] Ejecutar §6.2: mantenimiento del ritmo en IG+TikTok, con o sin Fase 2 según lo decidido en el checkpoint del día 90
- [ ] Primer contacto con 3-5 microinfluencers de running para posibles collabs, solo a partir de 1.000 seguidores propios
- [ ] Primera collab con microinfluencer (100-200 €) si hay presupuesto y base de seguidores
- [ ] Repaso de la identidad verbal cada 4-6 semanas: ¿el copy sigue el tono? ¿hay desviaciones?
- [ ] Checkpoint día 180: comparar contra metas ambiciosas de §1, decidir presupuesto de paid y plataformas para el segundo semestre

---

## 14. Próximos pasos (esta semana)

1. **Hoy**: validar este plan y abrir Instagram + TikTok con el kit de §3.1 (no X/YouTube/Threads/Bluesky todavía)
2. **Mañana**: configurar Zoho Mail si no está hecho (`docs/history/naming-decisions.md`) y crear `redes@mi-dorsal.es`
3. **Esta semana**: preparar los primeros 6-8 posts en Canva (los que no dependen de X/YouTube) y dejarlos en una carpeta de Drive
4. **Próxima semana**: cargar el calendario editorial en Google Sheets y empezar a publicar (lunes D0, §6)
5. **En 30 días**: primer checkpoint — revisión de qué ha funcionado, ajuste de pilares, doblar lo que mejor convierte

---

## 15. Referencias y documentos relacionados

> Nota: `AGENTS.md` se reorganizó el 9 sep 2026 como índice/router de solo 4 secciones — las referencias `§N` con N>4 de versiones anteriores de este documento ya no existían y se han sustituido abajo por la ruta real del contenido en `docs/core/` o `docs/history/`.

- **AGENTS.md** §1-2 — Qué es mi-dorsal, reglas que no se deben romper
- **docs/core/brand-voice.md** — Tono de voz y vocabulario (fuente actual, sustituye a lo que antes vivía en AGENTS.md §2)
- **docs/history/brand-identity.md** — Paleta de color, tipografía, logo
- **docs/history/naming-decisions.md** — Consistencia de naming (mi-dorsal / midorsal / @midorsal / #MiDorsal), estado de dominios, setup de Zoho Mail
- **docs/core/anti-patterns.md** — Reglas de copy que no se deben romper (Levante, testimonios)
- **docs/history/domain-glossary.md** — Vocabulario del dominio running ("popular" vs "amateur", etc.)
- **docs/core/billing-subscriptions.md** — Estado real del paywall Pro (hoy sin activar) — ver §5.1 antes de publicar cualquier copy con precio
- **docs/plans/BUSINESS_PLAN.md** §6.4 — Pricing recomendado (2,99€/24€) usado en este documento
- **docs/plans/MONETIZATION_PLAN.md** — Modelo de negocio de las 4 patas; §11bis de este documento complementa su Pata 1 (Ads) con canales de adquisición no cubiertos allí
- **docs/core/seo.md** — Estrategia SEO que debe ir alineada con el copy de redes
- **docs/core/blog-newsletter.md** — Blog "Historias de dorsal" y newsletter (cadencia real: 1 post/semana en blog, envío a suscriptores 1 vez/mes vía cron `newsletter-editorial` — no semanal, ver nota en §7 POST 25) — cada post del blog debe tener su campaña social

---

> **Última nota**: esta versión (revisada 9 sep 2026) recalibra el plan original de 90 días/6 plataformas a **180 días/2 plataformas** porque lo ejecuta 1 persona en paralelo con el desarrollo de producto (§0.1). Si en el checkpoint del día 90 (§13) las metas modestas de §1 se superan con margen y hay tiempo real disponible, es el momento de abrir X/YouTube (§3.2) y considerar el primer paid (§11bis.2) — no antes.
>
> Lo que NO es opcional: la consistencia. Publicar 2-3 posts/sem durante 24 semanas seguidas > publicar a ritmo agresivo 3 semanas y desaparecer dos meses.
