# DorsalSwap — Plan estratégico y de desarrollo (post-análisis competitivo)

> **Estado:** Documento vivo. Última revisión: 4 sept 2026.
> **Decisión estratégica base:** El mercado de dorsales en España YA tiene un player establecido (DorsalPro, SL constituida, 1-2 años en mercado, 3.648 carreras indexadas). No competimos frontalmente. Buscamos un nicho defendible.

---

## 0. Lo que sabemos ahora (y antes no)

### Competidores identificados

| Competidor | Tipo | Estado |
|---|---|---|
| **DorsalPro** (`dorsal.pro`) | Empresa formal (SOPA LAB SL), Next.js, 3.648 carreras, 0% comisión, SEO excelente, guías, comparativas. **Líder claro.** | Establecido |
| **Bibready** (`bibready.com`) | Proyecto con Phoenix/Elixir, cobertura internacional, multilenguaje, pero **0 listings en carreras top** (10K Valencia, Ironman 70.3, MM Benicasim todas vacías) | Early-stage |
| **TicketSwap** | Marketplace generalista, opera en España con Ticketmaster, **no especializado en running** | Lateral |
| **Wallapop / Milanuncios** | Generalistas, sin confianza ni reputación para dorsales | Sustituto pobre |
| **ForoAtletismo / Strava clubs / Telegram** | Underground, sin protección | Sustituto pobre |

### Implicación directa

> **Lanzar DorsalSwap como "otro marketplace más de dorsales" = perder contra DorsalPro.**
> **Lanzar DorsalSwap con un posicionamiento diferenciado = oportunidad real, pero más pequeña de lo que pensábamos.**

---

## 1. Posicionamiento: qué somos y qué NO somos

### 1.1. Lo que NO somos (por realismo competitivo)

- ❌ **NO somos un marketplace generalista de dorsales** (eso es DorsalPro, ya lo hace bien)
- ❌ **NO somos un sustituto de Wallapop** (no vamos a ganar en "compra-venta rápida")
- ❌ **NO somos el primer marketplace de dorsales en España** (llegamos 1-2 años tarde)
- ❌ **NO somos una herramienta para que corredores profesionales vendan dorsales** (no es el buyer persona)

### 1.2. Lo que SÍ somos (nuestra tesis)

**DorsalSwap es el sistema de cambio de dorsales de los corredores amateurs que ya planifican su temporada con mi-dorsal.**

En una frase: **"mi-dorsal para planificar tu temporada, DorsalSwap para resolver lo que no salió según el plan."**

Tres pilares:

1. **Integración nativa con mi-dorsal** (ventaja asimétrica real que DorsalPro y Bibready no pueden copiar)
2. **Nicho inicial ultra-específico: Comunidad Valenciana y Murcia** (zona donde mi-dorsal ya tiene datos, comunidad y credibilidad)
3. **Producto que mejora la vida del corredor, no la del especulador** (sin sobreprecio, sin listings dudosos, con verificación de política de la carrera)

### 1.3. Buyer persona revisado

| Persona | Antes (genérico) | Ahora (específico) |
|---|---|---|
| **Carlos** — corredor amateur 30-45 años, C. Valenciana | Compra/vende dorsal | **Planifica su temporada en mi-dorsal** y cuando no puede correr una carrera, usa DorsalSwap para ceder la plaza |
| **Lucía** — runner popular, busca dorsal para una agotada | Compra dorsal | **Está en mi-dorsal viendo carreras** y ve que hay listings disponibles |
| **Roberto** — organizador mediana carrera FEDME/RFEA | (no priorizado) | **Busca un partner tecnológico para su sistema de cambio de titular** y DorsalSwap es la opción local con datos en su zona |

### 1.4. La frase que diferencia

> **"DorsalSwap es la capa de imprevistos de tu temporada de running."**

Cuando te lesionas 1 semana antes del Maratón Valencia, cuando te sale un viaje de trabajo, cuando te quedas embarazada. No pierdes 80€. No recurres a Telegram a las 2am. **Lo cedes con un click** y la plaza la aprovecha otro.

---

## 2. Estrategia competitiva: cómo ganamos (o cómo no perdemos)

### 2.1. El plan de juego

| Eje | DorsalPro | DorsalSwap | Quién gana |
|---|---|---|---|
| **SEO generalista** | 3.648 páginas, guías, comparativas | No intentamos competir | DorsalPro |
| **Marketplace abierto** | Sí, "publica gratis en 3 min" | Sí, pero nicho | DorsalPro (en masa) |
| **Comisión** | 0% para siempre | 0% (MVP), después opcional | Empate |
| **Integración con planificador de carreras** | ❌ No | ✅ **mi-dorsal (único en el mercado)** | **DORSALSWAP** |
| **Foco geográfico** | Toda España | C. Valenciana, Murcia, Albacete (zona mi-dorsal) | Empate (DorsalPro si sale de zona) |
| **Datos de carreras** | 3.648 scrapeadas | 370+ scrapeadas + las que ya conoce mi-dorsal | DorsalPro en cantidad, nosotros en profundidad de zona |
| **Partnerships con organizadores locales** | Ninguno público | 2-3 objetivos (Behobia no, hay distancia; sí MM Alicante, San Silvestre, 10K Valencia) | **DORSALSWAP** (si lo conseguimos) |
| **Cumplimiento legal/tope de precio** | Flexible (DorsalPro deja subir hasta 110% en algunos casos) | **Topeado estricto a oficial + 25€ gastos** | **DORSALSWAP** (postura más defendible) |

### 2.2. La estrategia de "océano azul parcial"

DorsalPro y Bibready son **océano rojo** en "marketplace de dorsales". Nosotros vamos a un **mini-océano azul** que es la intersección de:

1. **Planificador de carreras** (mi-dorsal) × **Resolución de imprevistos** (DorsalSwap)
2. **C. Valenciana + Murcia** (zona mi-dorsal) × **Carreras ya scrapeadas** (370+)
3. **Precio oficial** (legalmente blindado) × **Comunidad verificada** (Clerk auth)

Si funciona en este nicho, expandimos. Si no funciona, aprendemos rápido y pivotamos.

---

## 3. Plan de desarrollo: 90 días, 4 sprints

### Sprint 0 (Semana 1-2): "Pivotaje interno"

**Objetivo:** Adaptar el código que ya tenemos al nuevo posicionamiento antes de lanzar.

**Trabajo técnico:**

- [ ] **Rebranding de la landing**: cambiar el copy de "marketplace generalista" a "la capa de imprevistos de tu temporada de running". Esto es CRÍTICO.
- [ ] **Filtro geográfico forzado en MVP**: solo mostrar carreras de Valencia, Alicante, Castellón, Murcia, Albacete. Esto evita el SEO head-to-head con DorsalPro en búsquedas generales.
- [ ] **Integración visual con mi-dorsal**: header con link cruzadolink (ya está), footer igual (ya está), sección "Tu temporada" en el dashboard de DorsalSwap que liste las carreras de mi-dorsal del usuario con listings disponibles.
- [ ] **Página de DorsalPro en el código de DorsalSwap**: NO. En su lugar, página `/vs-dorsalpro` con comparativa honesta (SEO long-tail: "dorsalpro vs dorsalswap", "dorsalpro alternativa").

**Trabajo de producto:**

- [ ] Reescribir las páginas legales con el tono "capa de imprevistos" en vez de "marketplace"
- [ ] Eliminar el OG image genérico. Crear uno específico para el nicho: "DorsalSwap — Cede o encuentra tu dorsal en la C. Valenciana y Murcia"
- [ ] Cambiar la meta description a algo específico de zona

**Trabajo de posicionamiento:**

- [ ] Decisión final sobre el dominio (DorsalSwap.es si está libre, sino .com)
- [ ] Decisión final sobre el deploy (Vercel separado, ya acordado)

**No-haceres (importantes):**

- ❌ No publicar 1.000 listings de prueba
- ❌ No intentar indexar todas las carreras de España
- ❌ No competir por palabras clave tipo "vender dorsal" (demasiado competido)

### Sprint 1 (Semana 3-4): "MVP real con listings"

**Objetivo:** 20-30 listings reales publicados, primer flujo end-to-end funcionando.

**Trabajo técnico (lo que ya tenemos, validar que funciona):**

- [ ] Deploy a Vercel con dominio configurado
- [ ] Convex deploy con las 8 tablas nuevas
- [ ] Clerk auth funcionando
- [ ] Test del flujo completo: crear listing → contactar → marcar completado
- [ ] Smoke test cross-link con mi-dorsal

**Trabajo de producto (mínimo):**

- [ ] Página `/carreras/[slug]` de DorsalSwap: muestra la carrera con sus listings activos
- [ ] Página `/carreras` (catálogo limitado a la zona): buscador + filtros
- [ ] Sistema de notificaciones por email funcional (los 5 tipos básicos)
- [ ] SEO básico: sitemap, robots, schema.org

**Trabajo de captación (CRÍTICO):**

- [ ] Publicar manualmente **20-30 listings de ejemplo**: tuyos propios + de 5-10 amigos corredores. NO esperar a que el usuario venga solo.
- [ ] Outreach personal a 30 corredores activos en grupos de Telegram/Strava de la zona
- [ ] Mensaje en 3-5 grupos de Strava de la C. Valenciana
- [ ] Post en ForoAtletismo con link

**Métricas Sprint 1:**
- 20-30 listings publicados
- 50-100 usuarios registrados
- 5-10 conversaciones iniciadas
- 1-3 cesiones completadas

**Go/No-Go al final de Sprint 1:**
- ✅ GO si: 20+ listings, 5+ conversaciones, alguna cesión completada
- ⚠️ PAUSA si: <20 listings, 0 conversaciones
- ❌ PIVOT si: <10 listings después de outreach agresivo

### Sprint 2 (Semana 5-8): "Diferenciación visible"

**Objetivo:** Características que DorsalPro y Bibready no tienen.

**Trabajo técnico:**

- [ ] **Widget de DorsalSwap embebido en mi-dorsal**: en cada ficha de carrera de mi-dorsal, mostrar "¿Hay dorsales disponibles? Ver →" (con link a DorsalSwap)
- [ ] **Alertas inteligentes en mi-dorsal**: si el usuario tiene una carrera en su calendario y aparece un listing, email
- [ ] **Bot de Telegram para DorsalSwap**: notificar listings nuevos en grupos de corredores de la zona
- [ ] **Verificación de política por carrera**: scraping automático de reglamentos para mostrar el policy en cada listing (ya tenemos la tabla `dorsalTransferPolicies`, falta populating)
- [ ] **Página `/equipo/asesoria`**: formulario para que organizadores pregunten por partnership

**Trabajo de captación:**

- [ ] Outreach a 5 organizadores medianos de la zona:
  - 10K Valencia Ibercaja
  - Media Maratón Alicante
  - Maratón Castellón (si existe)
  - 10K Murcia
  - San Silvestre de León (no es zona pero tiene producto de ejemplo)
- [ ] Publicar 1 guía SEO: "Cómo ceder tu dorsal en España: guía legal 2026"
- [ ] Publicar 1 comparativa: "DorsalSwap vs grupos de Telegram para corredores de la C. Valenciana"

**Métricas Sprint 2:**
- 50-80 listings totales
- 200-400 usuarios registrados
- 15-30 conversaciones iniciadas
- 5-15 cesiones completadas
- 1-2 conversaciones con organizadores iniciadas

**Go/No-Go:**
- ✅ GO si: 1 organizador medianamente interesado (reunión, no necesariamente partnership cerrado)
- ⚠️ PAUSA si: 0 interés de organizadores pero listings crecidos
- ❌ PIVOT si: 0 listings, 0 conversaciones, 0 interés de organizadores

### Sprint 3 (Semana 9-12): "Sostenibilidad defensiva"

**Objetivo:** Convertir tracción inicial en algo que DorsalPro no pueda replicar fácilmente.

**Trabajo técnico:**

- [ ] **Integración nativa con cronometradores**: si Dorsal42, MySports o RockTheSport tienen API, ofrecer botón de "solicitar cambio de titular" desde DorsalSwap
- [ ] **Sistema de reputación robusto**: badges, niveles (novato → confiable → veterano)
- [ ] **Programa de embajadores**: 3-5 corredores locales con descuento en carreras a cambio de promouvoir
- [ ] **Reporte mensual de dorsales cedidos por carrera** (dato que puede interesar a organizadores)
- [ ] **A/B test del copy de la landing** para mejorar conversión

**Trabajo de captación:**

- [ ] Acuerdo con 1 organizador (idealmente Media Maratón Alicante o Behobia, pero Behobia es Guipúzcoa — alejada de la zona C. Valenciana; candidato mejor: **10K Valencia Ibercaja** o **Maratón Valencia**)
- [ ] 1 artículo periodístico en un medio de running local (Runnea, Foroatletismo, etc.)
- [ ] Newsletter en mi-dorsal sobre DorsalSwap (1 email)

**Métricas Sprint 3:**
- 100-200 listings totales
- 500-1.000 usuarios registrados
- 30-50 conversaciones iniciadas
- 10-25 cesiones completadas
- 1 partnership formalizado (o Memorandum of Understanding)

**Decisión al final de Sprint 3 (Go/No-Go Y2):**
- ✅ **CONTINUAR como negocio** si: 1 partnership cerrado, >15 cesiones, MRR >200€
- ⚠️ **MODO MANTENIMIENTO** si: listings creciendo pero <10 cesiones, sin partnership
- ❌ **ARCHIVAR** si: <50 listings, <5 cesiones, 0 partnerships, burnout

---

## 4. Cambios al código que ya escribimos

### 4.1. Lo que SE QUEDA tal cual

- ✅ Schema de Convex (las 8 tablas son correctas y bien diseñadas)
- ✅ Lógica de listings (create, markReserved, markCompleted)
- ✅ Mensajería
- ✅ Reseñas
- ✅ Alertas
- ✅ Páginas legales (están bien redactadas, ajustamos copy)
- ✅ Branding DorsalSwap (paleta, logo, OG)
- ✅ Cross-link con mi-dorsal

### 4.2. Lo que HAY QUE AJUSTAR

| Componente | Cambio | Por qué |
|---|---|---|
| **Landing copy** | Reescribir headline: de "Cede o encuentra tu dorsal en 2 minutos" a "Cede o encuentra tu dorsal. Sin perder la temporada." | Posicionamiento |
| **Landing filtros geográficos** | Forzar C. Valenciana, Murcia, Albacete en Sprint 0-2 | Nicho |
| **Landing sección "vs DorsalPro"** | Quitar (es marketing, no producto) | No es tarea Sprint 0 |
| **Widget en mi-dorsal** | Añadir `/components/dorsal-swap-cta.tsx` que se renderiza en cada ficha de carrera de mi-dorsal | Diferenciación |
| **API de listings por carrera en mi-dorsal** | Endpoint nuevo que da listings activos de una carrera (id) | Reutilizar |
| **Términos y condiciones** | Añadir párrafo explicando el foco geográfico inicial | Claridad |
| **Email FROM** | dorsalswap@dorsalswap.es (ya está) | OK |
| **Precios seed** | Quitar el 0% comisión como mensaje principal, sustituir por "A precio oficial" | DorsalPro ya hizo el 0% su bandera, no competimos ahí |

### 4.3. Lo que HAY QUE QUITAR (en Sprint 0)

- ❌ Sección de la landing "Por qué DorsalSwap y no Wallapop" — compararse con Wallapop es posicionamiento de hace 2 años
- ❌ La mención a "Carreras populares, marathon, media maratón, 10K" como keywords en meta — demasiado genérico
- ❌ Página `/c/[slug]` como vista alternativa de carrera — al principio solo el tablón con filtro, no fichas duplicadas
- ❌ Página "Cómo funciona" demasiado detallada — reducir a 2 pasos simples

### 4.4. Lo que HAY QUE AÑADIR (en Sprint 0-1)

- ➕ Filtro de provincia visible en la home (no solo en `/listings`)
- ➕ Sección "Carreras de la semana" (las 5 con más listings) en home
- ➕ Banner superior con cross-link a mi-dorsal
- ➕ Página `/sobre-nosotros` honesta (somos 1 persona, no pretendemos ser "el equipo de DorsalSwap")
- ➕ Página `/preguntas-frecuentes` con 5-10 preguntas reales

---

## 5. Marketing y captación (lo que NO es código)

### 5.1. Canales prioritarios

1. **Comunidad mi-dorsal** (gratis, segmentado, alta calidad) — newsletter, post en el blog, banner
2. **Strava** — grupos locales C. Valenciana y Murcia, no como spam sino como utilidad
3. **ForoAtletismo** — 1 post detallado, no más
4. **Grupos de Telegram de carreras** — no spam, sino "He creado una herramienta para X, ¿opiniones?"
5. **SEO long-tail** — guías tipo "Cómo ceder dorsal Maratón Valencia" o "Cambio titular Maratón Alicante"

### 5.2. Outreach a organizadores (lista priorizada)

| Organizador | Carrera | Por qué | Probabilidad |
|---|---|---|---|
| 10K Valencia Ibercaja | 10K Valencia | Marca mi-dorsal, zona, gran volumen | Media-Alta |
| Media Maratón Alicante | MM Alicante | Carrera top zona, ya con datos | Media |
| Maratón Valencia | Maratón Valencia | La más grande, política clara, interés mediático | Baja (organizador enorme) |
| Maratón Castellón | Maratón Castellón | Zona, tamaño manejable | Media |
| Carrera del Alba | Varias en Valencia | Más pequeñas, accesibles | Alta |
| 10K Murcia | 10K Murcia | Zona, contacto accesible | Media |

**Mensaje de outreach (borrador):**

> Hola, soy Manu, fundador de DorsalSwap. He visto que [carrera X] tiene una política clara de cambio de titular en su web. He construido una herramienta que permite a los corredores ceder sus dorsales de forma rápida y verificada, y me gustaría saber si os interesaría una colaboración. Sin coste para vosotros. ¿Tienes 15 min para una llamada esta semana?

### 5.3. NO hacer (importante)

- ❌ No pagar ads en Meta/Google en Sprint 0-1 (CAC demasiado alto)
- ❌ No hacer outreach a DorsalPro directamente (no tiene sentido ahora)
- ❌ No hacer PR en medios nacionales (demasiado pronto)
- ❌ No ir a eventos / ferias de running (no hay tiempo, no es rentable aún)

---

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **No conseguimos listings en Sprint 1** | Media | Catastrófico | Outreach manual agresivo, contenido en grupos Strava, primeras 20-30 listings manuales por nosotros mismos |
| **DorsalPro reacciona y añade integración con planificadores** | Baja | Medio | No pueden. Nadie tiene la integración mi-dorsal. Construimos defensivamente en nuestro territorio. |
| **Un organizador grande nos rechaza y se alía con DorsalPro** | Media | Bajo | Escenario aceptable. Nuestro target son organizadores medianos. |
| **El SEO long-tail no trae tráfico** | Media | Medio | No apostamos todo a SEO. Apostamos a comunidad mi-dorsal. |
| **Burnout del founder** | Alta | Alto | Sprint 0-1 son 8h/semana. Si en Sprint 2 no hay tracción, parar. |
| **Cambio de ley que prohíbe reventas** | Baja | Alto | DorsalSwap es cesión a precio oficial. Somos los menos afectados. |
| **TicketSwap entra en running en España** | Baja | Alto | Diferencial sigue siendo integración mi-dorsal. No es replicable. |

---

## 7. Lo que cambia respecto al plan original

| Antes (plan v1) | Ahora (plan v2) |
|---|---|
| Marketplace generalista | Nicho: imprevistos para usuarios de mi-dorsal en C. Valenciana y Murcia |
| Compite con DorsalPro frontalmente | No compite. Posiciona al lado. |
| Ataca mercado "dorsales en España" | Ataca mercado "dorsales en C. Valenciana" |
| Basa SEO en keywords genéricas | Basa SEO en long-tail: nombres de carreras específicas |
| Revenue en Y1: 4.000€ esperado | Revenue en Y1: 1.000-2.000€ (más conservador) |
| "Empresa del running" | "Feature premium de mi-dorsal para imprevistos" |
| Sprint 0 = 2 semanas MVP completo | Sprint 0 = pivotaje interno + ajustes |

---

## 8. Decisiones que tú tienes que tomar antes de Sprint 0

- [ ] **Dominio**: ¿`dorsalswap.es` o `.com`? (o lo que esté libre)
- [ ] **Constituir SL o no**: para Sprint 0-2 no hace falta. Si en Sprint 3 hay partnership serio, sí.
- [ ] **Tiempo semanal comprometido**: 8h/semana mínimo para Sprint 0-1
- [ ] **Listings manuales**: ¿te comprometes a publicar 10-15 listings manualmente para el lanzamiento? (los tuyos propios + de amigos)
- [ ] **Outreach personal**: ¿estás dispuesto a escribir 30 mensajes directos a corredores en Telegram/Strava?
- [ ] **Outreach a organizadores**: ¿estás dispuesto a llamar a 5 organizadores de la zona?
- [ ] **Si en Sprint 3 no hay tracción, ¿qué haces?**: parar / pivotar / mantener en modo mínimo

---

## 9. Plan de 90 días en una línea por sprint

| Sprint | Duración | Frase |
|---|---|---|
| **0** | Sem 1-2 | Adaptar el código al nuevo posicionamiento y al nicho C. Valenciana |
| **1** | Sem 3-4 | Lanzar con 20-30 listings reales y validar el flujo |
| **2** | Sem 5-8 | Diferenciación visible: integración mi-dorsal, alertas, outreach organizadores |
| **3** | Sem 9-12 | Sostenibilidad: partnership, reputación, primer artículo SEO, decisión Y2 |

---

## 10. La regla de oro

> **No compitas con DorsalPro en su juego. Juega el tuyo: mi-dorsal + imprevistos + C. Valenciana.**
> 
> Si en 90 días no hay señales de tracción, el proyecto se archiva. No es un fracaso — es información valiosa. Y el código queda para otra cosa.

---

**Próximo paso:** Validar este plan contigo, y si lo apruebas, empiezo el Sprint 0 (ajustes al código que ya tenemos, no funcionalidades nuevas).
