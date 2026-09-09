# Plan de monetización · mi-dorsal

> **Misión:** convertir mi-dorsal en un proyecto sostenible económicamente en 12-18 meses, sin traicionar la propuesta de valor para el corredor.
>
> **Premisa:** la app ya tiene el activo más importante — 374+ páginas de carreras indexables con SEO técnico impecable. El reto ahora es **transformar tráfico en ingresos** sin morir de un modelo único.

---

## 🎯 Resumen ejecutivo

mi-dorsal tiene 4 grandes palancas de monetización, ordenadas por **cuándo se pueden activar** y por **apalancamiento sobre el activo actual** (catálogo + SEO + comunidad).

| Pata | Cuándo | Esfuerzo | Potencial 12m | Notas |
|------|--------|----------|--------------|-------|
| **1. Display Ads (AdSense + Mediavine)** | Mes 1-3 (post-dominio) | 🟢 Bajo | €200-800/mes | Base, no apalancarse solo en esto |
| **2. Afiliación material deportivo** | Mes 2-4 | 🟡 Medio | €300-1500/mes | Gran ROI con buen contenido |
| **3. Newsletter patrocinada** | Mes 3-6 | 🟡 Medio | €150-500/mes | Lista propia = activo defensivo |
| **4. Freemium / Suscripción** | Mes 6-12 | 🔴 Alto | €1000-5000/mes | El futuro real del negocio |

**Proyección realista a 12 meses** (con 50-100k visitas/mes orgánicas): **€1500-3500/mes** distribuidos entre las 4 patas.
**Proyección a 24 meses** (con modelo freemium pulido y 200k+ visitas): **€4000-10000/mes**.

> ⚠️ Estas cifras asumen que ejecutas SEO de contenidos (no solo técnico) y construyes una lista de email. Sin tráfico y sin lista, ninguna pata funciona.

---

## 🧱 Las 4 patas del modelo de negocio

### Pata 1: Display Ads (AdSense → Mediavine/Ezoic cuando crezca)

**Qué es:** anuncios gráficos/texto servidos por una red publicitaria. Tú pones el inventario (páginas vistas), ellos ponen los anunciantes.

**Cuándo activar:** solo con dominio propio + 6-10k visitas/mes orgánicas como mínimo.

**Por qué empezar aquí:**
- Es 0 esfuerzo técnico (ya tenemos el hook `GoogleAdSense` listo, solo configurar `NEXT_PUBLIC_ADSENSE_CLIENT_ID`)
- Genera ingresos desde el día 1 sin afectar al producto
- "Paga las facturas" mientras construyes las otras patas

**Estrategia por nivel de tráfico:**

| Visitas/mes | Red recomendada | RPM esperado (€) | Ingreso estimado/mes |
|-------------|-----------------|------------------|---------------------|
| <50k | **Google AdSense** | 1.5-4 (nicho running) | €75-200 |
| 50-200k | **Ezoic** (sin mínimo) | 3-8 | €150-1500 |
| >200k | **Mediavine** (mín. 50k sesiones) | 8-15 | €1500-3000+ |

**Ubicaciones de anuncios (no saturar):**
- 1 banner en la home (debajo del hero, no encima)
- 1 banner en `carreras/[slug]` (después de los datos clave, antes de la inscripción)
- 1 banner en la lista de `/carreras` (después de 6-9 cards, en medio)
- **NUNCA** intersticiales ni popups (penalización SEO + mala UX)

**Esfuerzo:** 1-2 días (config + esperar aprobación de AdSense, 1-4 semanas)
**Riesgo:** AdSense puede rechazar la web (contenido "duplicado" de carreras scrapeadas — tienes que demostrar que aportas valor con `description` propio). Mitigación: enriquece las `description` desde el admin con texto original por carrera.

---

### Pata 2: Afiliación de material deportivo (Awin, Daisycon, TradeDoubler, Amazon)

**Qué es:** recomiendas productos (zapatillas, GPS, ropa, geles) con un enlace especial. Si alguien compra, tú cobras 3-12% de comisión.

**Por qué es la 2ª pata:**
- Margen alto sin coste de inventario
- El corredor está en mindset de compra (mirando carreras → "¿qué me pongo?")
- SEO de "mejores zapatillas trail 2026" tiene búsquedas reales (informacional, alto CPM)

**Categorías de producto a recomendar:**

| Categoría | Marcas top | Comisión típica | Búsquedas SEO target |
|-----------|-----------|-----------------|----------------------|
| Zapatillas trail | Salomon, Hoka, Brooks, New Balance | 5-8% | "mejores zapatillas trail 2026" |
| Zapatillas road | Asics, Nike, Adidas, Saucony | 5-8% | "mejores zapatillas 10K" |
| GPS/reloj | Garmin, Suunto, Coros, Polar | 4-6% | "mejor GPS running 2026" |
| Geles/nutrición | Maurten, SIS, Precision Fuel | 8-12% | "mejores geles maratón" |
| Complementos | Compressport, Lurbel, Raidlight | 8-10% | "calcetines compresión running" |

**Redes de afiliación a unirse (todas gratis):**
- **Awin** (es la más grande en España, 15k+ anunciantes)
- **Daisycon** (fuerte en ES, fácil aprobación)
- **Amazon Asociados** (peor comisión 1-3% pero conversión brutal)
- **TradeDoubler** (decaída pero quedan marcas)

**Formato del contenido (clave para SEO):**
- 1 artículo largo (1500-2500 palabras) por categoría: "Las 10 mejores zapatillas para trail en 2026"
- Affiliate links inline en el texto + tabla comparativa al final
- 1 actualización anual del contenido
- Ejemplo: `/guias/mejores-zapatillas-trail-2026`

**Ubicaciones inteligentes (no solo en artículos):**
- En `carreras/[slug]`: bloque "Material recomendado para esta carrera" según tipo (trail vs road) y distancia
- En perfil de usuario: "Si quieres mejorar tu 10K, mira estas zapatillas"
- Email de resultados: "¡Felicidades! Si quieres repetir marca, mira estas recomendaciones"

**Esfuerzo:** 2-3 días setup (unirse a redes, validar, configurar enlaces) + 1 artículo/semana los primeros 2 meses
**Riesgo:** Google puede detectar si todos los enlaces son `nofollow` o `sponsored` (deben serlo por normativa). Mitigación: marca los enlaces con `rel="sponsored noopener"`.

---

### Pata 3: Newsletter patrocinada (Resend ya lo tienes)

**Qué es:** emails semanales a tu lista con un resumen de carreras + 1-2 patrocinios de marcas. Cobras por envío patrocinado.

**Por qué construir esto YA (mes 3):**
- Una lista de email es el activo más defensivo que existe (no depende de Google)
- 1000 suscriptores activos en nicho running valen **€150-400 por envío patrocinado**
- Es el embudo para vender freemium más adelante

**Formato de la newsletter "mi-dorsal semanal":**

```
Asunto: 5 carreras que no te puedes perder este finde en Levante [+ 1 sorpresón]

👟 Carrera destacada de la semana
   Maratón de Valencia 2026 — Abre inscripción mañana 9:00

🗓️ Este finde (3 carreras)
   - 10K Benidorm (sábado 9:30h)
   - Trail de la Calderona (domingo 8:00h)
   - Media Maratón Alicante (domingo 10:00h)

💡 Consejo de la semana
   "Cómo evitar el muro del km 30 en tu primera maratón"

🛒 Patrocinado por Salomon
   [Imagen + CTA: nuevas Speedcross 6 con 20% dto para suscriptores]

📊 Ranking actualizado: TOP 3 carreras de la semana (votadas por la comunidad)
```

**Embed de opt-in en la app (alta conversión):**
- Modal al alcanzar 5 carreras en el calendario
- Banner sticky en home (no intrusivo, en la parte inferior)
- Después de votar una carrera: "Suscríbete para no perderte las mejores"
- Footer en cada email de resultados que ya envías

**Estrategia de crecimiento (objetivo: 2000 suscriptores en 6 meses):**
- Lead magnet: "Guía PDF gratuita: Plan de 12 semanas para tu primera media maratón" (a cambio del email)
- Cross-promo con otros newsletters del nicho (corredores populares, podcasts de running)
- Pop-up exit-intent en el blog (cuando lo crees)

**Tarifas de patrocinio (industria nicho running España):**
- 1 mención en newsletter (1 envío): €80-200 por 1000 suscriptores
- 1 mención + 1 artículo en la web: €200-500
- 1 mención + 1 post en redes: €300-600
- Paquete mensual (4 envíos): €500-1500

**Esfuerzo:** 1 semana setup (template, opt-in, lead magnet) + 1 email/semana
**Riesgo:** baja entrega si no configuras SPF/DKIM en Resend. Mitigación: ya tienes Resend; verifica los DNS.

---

### Pata 4: Freemium / Suscripción (el jackpot a medio plazo)

**Qué es:** una capa gratuita muy generosa + funciones premium que aportan valor real. Cobras 3-9€/mes o 29-79€/año.

**Por qué es EL modelo ganador para este tipo de app:**
- Es SaaS puro, margen ~90% después del primer año
- Los corredores son increíblemente fieles a las herramientas que usan (Strava, Garmin Connect)
- Ya tienes features avanzadas (predicciones, Strava, Garmin) — solo hay que empaquetarlas

**Estructura freemium propuesta:**

| Feature | Free | Premium (5€/mes o 39€/año) |
|---------|------|----------------------------|
| Ver carreras | ✅ | ✅ |
| Calendario básico | ✅ (5 carreras) | ✅ (ilimitado) |
| Resultados por email | ✅ (3 últimos) | ✅ (ilimitado + diploma PDF) |
| Votar y comentar | ✅ | ✅ |
| **Predicciones de tiempo** | 1/mes | Ilimitadas + nivel confianza alto |
| **Planificación inteligente de temporada** | ❌ | ✅ (sugiere qué carreras encajan con tus PRs) |
| **Sincronización Strava/Garmin** | ❌ | ✅ |
| **Alertas personalizadas** (carrera en tu provincia, nueva edición, etc.) | ❌ | ✅ |
| **Export del calendario a Google/Apple** | ❌ | ✅ |
| **Widget para tu web/blog** (carreras que corres) | ❌ | ✅ |
| **Soporte prioritario** | ❌ | ✅ (24h respuesta) |
| **Estadísticas avanzadas** (evolución PRs, comparativa con comunidad) | ❌ | ✅ |

**Pricing psychology:**
- 4.99€/mes es el "sweet spot" para apps de fitness en Europa
- 39€/año = 35% descuento = mejora conversión 2-3x
- Trial de 14 días sin tarjeta (conversión 8-15%)
- Plan familiar 9.99€/mes (5 corredores — aprovechas la dinámica de grupo)

**Stack técnico para el paywall:**
- **Stripe** (lo más limpio para SaaS europeo)
- Clerk ya lo tienes para auth, lo integra con Stripe nativamente
- Convex: nueva tabla `subscriptions` con `userId`, `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `status`
- Webhook de Stripe → mutation en Convex para actualizar el estado
- Componente `<Paywall>` que envuelve features premium

**Métricas objetivo:**
- 1000 usuarios registrados → 30-50 premium (3-5%) = €150-250/mes
- 5000 usuarios registrados → 200-400 premium = €1000-2000/mes
- 20000 usuarios → 1000-2000 premium = €5000-10000/mes

**Esfuerzo:** 3-4 semanas (modelo de datos + Stripe + UI + páginas account + emails transaccionales)
**Riesgo:** baja conversión si las features premium no aportan valor claro. Mitigación: lanzar primero el trial de 14 días, medir qué features usan los trial users, quedarse con las 3 más usadas.

---

## 🗺️ Roadmap por trimestres

### Q1 (mes 1-3): Fundación
- [ ] Comprar dominio `mi-dorsal.es` y configurar DNS
- [ ] Solicitar AdSense (tarda 1-4 semanas en aprobar)
- [ ] Activar `NEXT_PUBLIC_ADSENSE_CLIENT_ID` cuando aprueben
- [ ] Unirse a Awin + Daisycon (afiliación)
- [ ] Publicar 4 artículos de guías SEO ("mejores zapatillas trail/road 10K/media maratón")
- [ ] Empezar a construir lista de email (lead magnet PDF)
- [ ] **Objetivo ingresos:** €0-100/mes
- [ ] **Objetivo tráfico:** 5-10k visitas/mes orgánicas

### Q2 (mes 4-6): Crecimiento de tráfico + afiliados
- [ ] Publicar 8-12 guías SEO más (long-tail: "zapatillas para [distancia] en [terreno]")
- [ ] Lanzar newsletter semanal
- [ ] Cerrar 2-3 patrocinios de newsletter
- [ ] Empezar a medir qué productos convierten mejor (Awin dashboard)
- [ ] Considerar Ezoic si AdSense se queda corto
- [ ] **Objetivo ingresos:** €300-800/mes
- [ ] **Objetivo tráfico:** 20-40k visitas/mes orgánicas
- [ ] **Objetivo lista email:** 1000-2000 suscriptores

### Q3 (mes 7-9): Construcción del freemium
- [ ] Diseñar UX del paywall y feature gating
- [ ] Integrar Stripe + Clerk + Convex (subscriptions table)
- [ ] Crear páginas /cuenta, /cuenta/suscripcion, /cuenta/facturas
- [ ] Lanzar beta cerrada del premium (50-100 usuarios early adopters)
- [ ] Iterar pricing y feature set según feedback
- [ ] **Objetivo ingresos:** €800-2000/mes
- [ ] **Objetivo conversiones premium:** 20-50 suscriptores

### Q4 (mes 10-12): Lanzamiento público + escala
- [ ] Lanzamiento público del premium con campaña (Product Hunt, RRSS, newsletter)
- [ ] Plan familiar
- [ ] Programa de referidos (1 mes gratis por cada amigo)
- [ ] Primer contenido patrocinado en la web (no newsletter)
- [ ] Evaluar Mediavine si llegas a 50k sesiones
- [ ] **Objetivo ingresos:** €1500-3500/mes
- [ ] **Objetivo conversiones premium:** 100-300 suscriptores

### Año 2:
- [ ] Marketplace de entrenadores y planes
- [ ] API pública (B2B)
- [ ] Carreras virtuales patrocinadas
- [ ] App nativa (PWA es buen primer paso, pero iOS/Android abre otro mercado)

---

## 📊 KPIs a monitorizar desde el día 1

| KPI | Herramienta | Meta mes 3 | Meta mes 6 | Meta mes 12 |
|-----|-------------|-----------|-----------|-------------|
| Visitas orgánicas/mes | Google Search Console | 5k | 20k | 50k+ |
| CTR orgánico | Search Console | 3% | 4% | 5% |
| Suscriptores newsletter | Resend | 300 | 1500 | 3000 |
| Tasa apertura newsletter | Resend | 35% | 40% | 45% |
| Ingresos AdSense | AdSense dashboard | €50 | €200 | €500 |
| Ingresos afiliación | Awin/Daisycon | €0 | €100 | €400 |
| Ingresos newsletter | Facturación manual | €0 | €150 | €400 |
| Suscriptores premium | Stripe | 0 | 0 | 100 |
| MRR (Monthly Recurring Revenue) | Stripe | €0 | €0 | €500 |
| Churn rate premium | Stripe | — | — | <5%/mes |

---

## 💰 Estimaciones de retorno por escenario

| Escenario | Visitas/mes | Lista email | Premium | Ingresos/mes | Notas |
|-----------|-------------|-------------|---------|--------------|-------|
| **Triste** | 3k | 200 | 0 | €20-50 | Solo AdSense residual, sin tracción |
| **Conservador** | 15k | 800 | 30 | €300-600 | Adsense + afiliación, freemium fallando |
| **Esperado** | 40k | 2000 | 100 | €800-1800 | Mix balanceado de las 4 patas |
| **Bueno** | 100k | 5000 | 300 | €2500-5000 | Premium tirando del carro |
| **Éxito** | 250k+ | 12000 | 800+ | €6000-15000 | Producto maduro, momento de contratar |

**Probabilidad subjetiva de cada escenario en 12 meses:** 10% triste, 30% conservador, 40% esperado, 18% bueno, 2% éxito.

---

## ⚠️ Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Google te penaliza por contenido "agregador" | Media | Alto | Enriquece cada carrera con texto original, fotos, reseñas propias |
| AdSense rechaza o banea | Baja | Medio | Ten siempre Awin/Ezoic como backup; nunca pongas todos los huevos en AdSense |
| Los organizadores se enfadan por usar sus datos | Media | Medio | Páginas legales claras + email de contacto + siempre enlace a la fuente oficial |
| Churn alto en premium | Alta | Alto | Empieza con precio bajo (2.99€), sube cuando añadas valor; focus en retención vs adquisición |
| Saturación del mercado (ya hay RaceChip, Runedia, etc.) | Alta | Bajo | Diferenciador: predicción de tiempo con IA + tracking automático de dorsal (es ÚNICO) |
| Problemas legales con RGPD/AGPD | Baja | Alto | Ya tienes banner + páginas legales. Auditoría anual con abogado |
| Dependencia de Clerk/Convex/Stripe | Baja | Medio | Stack moderno y estable. Ten los datos exportables. Plan de migración documentado |

---

## 🚀 Top 5 acciones para empezar esta semana

Si tuviera que elegir **5 cosas que hacer HOY** para acelerar la monetización:

1. **Configurar `NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_CONVEX_URL` en Vercel** (10 min) → sin esto, AdSense ni puede validar tu dominio.

2. **Crear la cuenta de Google Search Console y enviar el sitemap** (15 min) → empiezas a indexar 374+ páginas en Google. **Cada día que pasa sin esto son visitas que pierdes.**

3. **Comprar `mi-dorsal.es`** (15 min en Namecheap/Cloudflare, ~10€/año) → bloquea AdSense y queda profesional para afiliados y patrocinios. El subdominio `*.vercel.app` mata credibilidad.

4. **Crear cuenta en Awin** (30 min) → la red de afiliados más grande de España. Te aprueba en 1-3 días. Mientras tanto, investiga qué marcas de running están.

5. **Escribir 1 guía SEO**: "Las 10 mejores zapatillas para trail en 2026" (3-4h) → tu primer activo de monetización por afiliación. Intern linking masivo desde todas las carreras de trail en la BD.

---

## 📚 Referencias y lecturas recomendadas

- **"The 1-Page Marketing Plan"** — Allan Dib (framework simple para cualquier negocio)
- **"Obviously Awesome"** — April Dunford (positioning, clave para freemium)
- **"Newsletter Ninja"** — Matt McGarry (si te gusta el camino de la newsletter)
- **"The SaaS Playbook"** — Rob Walling (todo sobre freemium + pricing)
- **Google AdSense Help** — [support.google.com/adsense](https://support.google.com/adsense)
- **Awin España** — [awin.com/es](https://www.awin.com/es)
- **Stripe Atlas** — para crear la empresa (LLC o SL) si el proyecto despega

---

## 🎯 Conclusión: tu ventaja competitiva real

La mayoría de sitios de carreras en España (Runedia, CarrerasPopulares, etc.) son **medios de contenido** — escriben artículos, ganan con display y afiliación. **Tú eres un producto SaaS** — el corredor vuelve cada semana porque la app le resuelve un problema (saber su tiempo, recibir su resultado, planificar temporada).

Esta diferencia es la que te permite aspirar al **modelo freemium** que ninguno de ellos ha podido desplegar bien, porque su modelo de negocio (mucho tráfico AdSense) penaliza meter un paywall.

**No compitas en tráfico contra Runedia. Compite en engagement y retención.** Cada usuario que vuelve cada semana a mirar su calendario es un suscriptor premium potencial a 5€/mes. 1000 de esos = €5000 MRR.

Eso es lo que persigue este plan.

---

*Última revisión: 4 de septiembre de 2026*
*Próxima revisión sugerida: 4 de diciembre de 2026 (trimestral)*
