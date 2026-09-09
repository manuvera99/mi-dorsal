# Plan de negocio · mi-dorsal

> **Fecha**: 8 sep 2026 · **Autor**: análisis a partir del estado real del proyecto
> **Stack actual**: Next.js 15 + Convex 1.18 + Clerk + Resend + Vercel + Stripe (via Clerk Billing) + OpenAI gpt-4o-mini
> **Pricing configurado en Clerk dashboard (no activado aún)**: Free 0 € · Premium 4,99 €/mes · Premium Anual 39 €
> **Pricing alternativo propuesto (freemium v2)**: Free · **Pro 2,99 €/mes** o **24 €/año** (anual como push principal)

> ⚠️ **Este documento NO sustituye** a `MONETIZATION_PLAN.md` (4 patas) ni a `MONETIZATION_FREEMIUM_TIERS.md` (zoom freemium v2). Es la **capa de modelado financiero** que responde a las preguntas: ¿cuánto cuesta a escala? ¿es rentable con los precios actuales? ¿cuándo se llega a break-even?

---

## 1. TL;DR — la respuesta corta

| Pregunta | Respuesta |
|---|---|
| **¿Cuánto cuesta la app hoy?** | **~5 €/mes** (Vercel Pro $20 con crédito incluido + Convex free ~$0 + Clerk free $0 + Resend free $0 + IA ~$0). Coste efectivo muy bajo porque el crédito de Vercel Pro cubre el tráfico inicial. |
| **¿Cuánto costará cuando escale a 20.000 MAU?** | **~120-180 €/mes** (Vercel Pro $20 + ~$60-120 de overage de bandwidth/funciones + Convex $0-5 + Clerk $0 + Resend Pro $20 + IA $1-3). |
| **¿A 100.000 MAU?** | **~600-1.000 €/mes** (Vercel Pro $20 + overage $300-500 + Convex $25-50 + Clerk $0-1.000 si pasa de 50k MRU + Resend $50-90 + IA $5-10 + Stripe fees sobre ingresos). |
| **¿Es rentable con 4,99 €/mes?** | **Sí**, con break-even a ~30-50 Pro pagando. Margen bruto ~85% por usuario. |
| **¿Es más rentable con 2,99 €/mes?** | **Sí en términos de LTV total**, porque sube la conversión esperada del 2-3% al 3-5%. El ingreso total esperado es mayor a igualdad de tráfico. |
| **Plan de acción recomendado** | **Validar pricing con 5-10 entrevistas antes de activar** (semana 1) → activar Clerk Billing con 2,99 €/mes + 24 €/año (semana 2) → ejecutar 4 patas en paralelo los 90 días siguientes. |

---

## 2. Estado actual del stack y coste base

Stack confirmado en `package.json` y AGENTS.md §6.4:

| Servicio | Plan actual estimado | Coste real al mes | Notas |
|---|---|---|---|
| **Vercel** | Pro (producción con dominio) | **$20-40** | Pro con $20/seat + crédito. Tráfico actual < 1 TB bw → probablemente <$40 con overage. |
| **Convex** | Free/Starter (cap $0-1/mes) | **$0-2** | 1M function calls/mes incluidos. A escala actual, ~50-200k calls/mes. |
| **Clerk** | Free (Hobby) | **$0** | < 10k MRU. 50k MRU son gratis. |
| **Resend** | Free | **$0** | 3k emails/mes incluidos. 100/día cap → primer cuello de botella. |
| **OpenAI gpt-4o-mini** | Pay-per-use | **~$0-1** | Solo extracción admin + 0-5 calls/mes de coach IA mientras no hay Pro. |
| **Stripe (via Clerk Billing)** | Sin activar | **$0** | Esqueleto listo, falta setup. |
| **Dominio mi-dorsal.com/.es** | Comprado | **~19 €/año** | ~1,6 €/mes amortizado. |
| **Zoho Mail free** | Pendiente (AGENTS.md §13.4) | **0 €** | 5 buzones gratis. |
| **TOTAL efectivo al mes** | | **~22-46 €/mes** | Dominio aparte. |

**Insight clave**: el coste base es **ridículamente bajo** para una web app en producción. Esto se debe a:
- Vercel Pro incluye 1 TB de bandwidth y 10M edge requests (suficiente para ~100k visitas/mes).
- Convex free tier incluye 1M function calls (suficiente para ~5k MAU con uso moderado).
- Clerk free sube a 50k MRU desde feb 2026 (insuperable para v1).
- Resend free es el primer cuello: con 100 emails/día como techo, **no puedes enviar la newsletter semanal a más de 700 suscriptores sin pagar**.

**Coste dominado por Vercel Pro** (fijo de $20) hasta que el bandwidth se dispare o tengas > 50k MRU.

---

## 3. Costes de infraestructura al escalar

Modelado de **costes variables** (no fijos) según volumen de uso real estimado de un usuario activo al mes. Fuentes: tarifas públicas verificadas a 2026-08 (Vercel docs, convex.dev/pricing, clerk.com/pricing, resend.com/pricing).

### 3.1 Consumo unitario por usuario activo (MAU)

| Recurso | Por MAU/mes | Fuente / razón |
|---|---|---|
| Vercel bandwidth | ~50-100 MB | Catálogo, ficha carrera, imágenes, polylines. 1 página = 1-2 MB, ~10-15 pages/mes/usuario. |
| Vercel function invocations | ~5-20 | Predicciones VDOT, render PDF diploma, generación OG images, API routes. |
| Vercel edge requests | ~50-200 | SSR pages de Next.js. |
| Convex function calls | ~50-150 | Queries reactivas (carruseles, perfil, calendario, hilos). |
| Convex DB storage | ~5-50 KB | Perfil, PRs, hilo del corredor. |
| Convex file storage | ~100 KB - 2 MB | Strava exports, fotos perfil. |
| Convex egress | ~5-20 MB | Datos que vuelven al cliente. |
| Clerk MRU | 1 | Un usuario retenido al mes = 1 MRU. |
| Resend emails | 1-3 | Newsletter + resultados + transaccionales. |
| OpenAI gpt-4o-mini (Pro) | 4 calls/mes | Coach IA con rate-limit. |
| PDF diplomas (Vercel function + bw) | 0.5-2 renders | Free: 3, Pro: hasta 20. |

### 3.2 Costes mensuales por escenario de escala

Supuestos: 1 MAU = ~30% de usuarios registrados (ratio industria nicho fitness en web apps con retorno semanal). **Anualizado en USD, conversión 1 USD ≈ 0,92 EUR a 2026-09.**

| Escenario | **Actual** | **Bajo** | **Medio** | **Alto** | **Sueño** |
|---|---|---|---|---|---|
| Usuarios registrados | ~50-200 | 1.000 | 5.000 | 20.000 | 100.000 |
| MAU | ~20-60 | 300 | 1.500 | 6.000 | 30.000 |
| Pro pagando | 0 | 5-15 | 50-150 | 200-600 | 1.000-3.000 |
| | | | | | |
| **Vercel Pro seat** | $20 | $20 | $20 | $20 | $20 |
| **Vercel bandwidth** (50-100 MB/MAU) | < 1 GB → $0 | 15-30 GB → $0 | 75-150 GB → $0 | 300-600 GB → $0-50 | 1,5-3 TB → $75-300 |
| **Vercel function invocations** | < 100k → $0 | 1-5M → $0 | 5-30M → $0-30 | 30-120M → $0-75 | 150-600M → $90-360 |
| **Vercel edge requests** (50-200/MAU) | < 1k → $0 | 15-60k → $0 | 75-300k → $0 | 0,3-1,2M → $0 | 1,5-6M → $0 |
| **Subtotal Vercel** | **$20** | **$20** | **$20-50** | **$20-145** | **$185-680** |
| | | | | | |
| **Convex function calls** (50-150/MAU) | < 10k → $0 | 15-45k → $0 | 75-225k → $0 | 0,3-0,9M → $0 | 1,5-4,5M → $5-8 |
| **Convex DB storage** (0,5-1 MB/MAU) | < 0,1 GB → $0 | 0,15-0,3 GB → $0 | 0,75-1,5 GB → $0-1 | 3-6 GB → $2-3 | 15-30 GB → $8-12 |
| **Convex file storage** | < 0,1 GB → $0 | 0,03-0,6 GB → $0 | 0,15-3 GB → $0-1 | 0,6-12 GB → $0-1 | 3-60 GB → $0-1 |
| **Convex action compute** | < 1 GB-hr → $0 | 3-15 GB-hr → $0 | 15-75 GB-hr → $0-20 | 75-300 GB-hr → $20-95 | 375-1500 GB-hr → $120-490 |
| **Subtotal Convex** | **$0** | **$0-1** | **$0-22** | **$22-99** | **$133-511** |
| ¿Cuándo saltar a Professional ($25/dev)? | No | No | No | Probable | **Sí, obligatorio** |
| | | | | | |
| **Clerk MRU** | < 50k → $0 | 300 → $0 | 1.500 → $0 | 6.000 → $0 | 30.000 → $0 |
| **Subtotal Clerk** | **$0** | **$0** | **$0** | **$0** | **$0** (hasta 50k) |
| ⚠️ Si pasas 50k MRU | | | | | $0,02/MRU extra |
| | | | | | |
| **Resend emails** (1-3/MAU) | < 100 → $0 | 300-900 → $0 | 1.500-4.500 → $0-20 | 6.000-18.000 → $0-20 | 30.000-90.000 → $20-90 |
| **Subtotal Resend** | **$0** | **$0** | **$0-20** | **$0-20** | **$20-90** |
| ⚠️ Cap diario Free = 100/día | | | | | Tope real |
| | | | | | |
| **OpenAI gpt-4o-mini** | < $0,01 | $0,01-0,03 | $0,04-0,20 | $0,15-0,60 | $1-3 |
| **Subtotal IA** | **~$0** | **~$0** | **~$0-1** | **~$1-2** | **~$2-5** |
| | | | | | |
| **Stripe fees** (1,4% + 0,30 € EU) | $0 | < $1 | $1-5 | $5-25 | $25-100 |
| | | | | | |
| **TOTAL USD/mes** | **~$20** | **~$20-22** | **~$22-100** | **~$50-300** | **~$365-1.400** |
| **TOTAL EUR/mes** (×0,92) | **~18 €** | **~18-20 €** | **~20-92 €** | **~46-276 €** | **~336-1.288 €** |

**Lectura clave**: el coste total escala **sublinealmente** con el tráfico porque los tiers gratuitos cubren MUCHO. Los saltos grandes son:
- **Resend Free → Pro ($20/mes)**: cuando pasas de 3.000 emails/mes (≈ 1.000-1.500 MAU con 2 emails/mes).
- **Vercel bandwidth overage**: cuando pasas de 1 TB/mes (≈ 10-20k MAU con 100 MB/usuario, asumiendo ~50% del tráfico a `/carreras` y fichas).
- **Convex Professional ($25/dev)**: cuando la combinación de function calls + action compute + storage supera Starter + overage. Típicamente a 20-30k MAU.
- **Clerk Pro ($25/mes)**: solo si pasas de 50k MRU. Mucho margen hasta entonces.

---

## 4. Modelo de ingresos (4 patas)

Síntesis de `MONETIZATION_PLAN.md`. Conversión y ARPU basados en benchmarks nichos fitness (ProductLed, ProfitWell, OpenView) y comparables (ClubRunning 37k usuarios, CorrerJuntos, Strava España).

### 4.1 Pata 4: Freemium / Suscripción Pro (la que más escala)

Asumimos **modelo freemium v2 (2,99 €/mes o 24 €/año)** con 60% anual / 40% mensual en year 1. **Comparativa con el modelo actual configurado (4,99 €/mes / 39 €/año) abajo**.

| Escenario | Usuarios | Conversión Pro | Pro activos | MRR (€) | ARR (€) |
|---|---|---|---|---|---|
| Actual | 200 | — | 0 | 0 | 0 |
| Bajo | 1.000 | 3% | 30 | 90 | 1.080 |
| Medio | 5.000 | 4% | 200 | 600 | 7.200 |
| Alto | 20.000 | 5% | 1.000 | 3.000 | 36.000 |
| Sueño | 100.000 | 5% | 5.000 | 15.000 | 180.000 |

**ARPU ponderado** (60% anual a 2 €/mes, 40% mensual a 2,99 €/mes): **~2,38 €/mes**. Redondeamos a **2,50 € ARPU** para el modelo.

**LTV medio** a 5% churn mensual = 1/0,05 = 20 meses × 2,50 € = **~50 € LTV**.

### 4.2 Pata 1: Display Ads (AdSense → Ezoic → Mediavine)

| Escenario | Visitas/mes | Red | RPM | Ingreso/mes |
|---|---|---|---|---|
| Actual | <1k | — | — | 0 € |
| Bajo | 10k | AdSense | 2,5 € | 25 € |
| Medio | 50k | AdSense/Ezoic | 4 € | 200 € |
| Alto | 200k | Ezoic/Mediavine | 8 € | 1.600 € |
| Sueño | 500k+ | Mediavine | 12 € | 6.000 € |

### 4.3 Pata 2: Afiliación material deportivo (Awin, Daisycon, Amazon)

| Escenario | Visitas/mes | Comisión efectiva | Ingreso/mes |
|---|---|---|---|
| Bajo | 10k | 0,005 €/visita | 50 € |
| Medio | 50k | 0,008 €/visita | 400 € |
| Alto | 200k | 0,010 €/visita | 2.000 € |
| Sueño | 500k+ | 0,012 €/visita | 6.000 € |

### 4.4 Pata 3: Newsletter patrocinada

| Escenario | Suscriptores | Patrocinios/mes | Ingreso/mes |
|---|---|---|---|
| Bajo | 500 | 0-1 | 0-80 € |
| Medio | 2.000 | 1-2 | 150-400 € |
| Alto | 5.000 | 2-4 | 500-1.200 € |
| Sueño | 12.000+ | 4-8 | 1.200-3.000 € |

### 4.5 Ingreso total combinado

| Escenario | Pro | Ads | Afiliación | Newsletter | **TOTAL/mes** |
|---|---|---|---|---|---|
| Actual | 0 € | 0 € | 0 € | 0 € | **0 €** |
| Bajo (1k usuarios) | 90 € | 25 € | 50 € | 0-80 € | **165-245 €** |
| Medio (5k usuarios) | 600 € | 200 € | 400 € | 150-400 € | **1.350-1.600 €** |
| Alto (20k usuarios) | 3.000 € | 1.600 € | 2.000 € | 500-1.200 € | **7.100-7.800 €** |
| Sueño (100k usuarios) | 15.000 € | 6.000 € | 6.000 € | 1.200-3.000 € | **28.200-30.000 €** |

---

## 5. Punto de equilibrio (break-even)

### 5.1 Break-even operativo (costes infra cubiertos)

Con la estructura de costes del §3:

| Escenario | Costes infra | Ingresos Pro | Ingresos totales (4 patas) | **¿Break-even?** |
|---|---|---|---|---|
| Actual | ~20 €/mes | 0 € | 0 € | ❌ No (subvencionado por Manu) |
| Bajo (1k) | ~20 €/mes | 90 € | 165-245 € | ✅ **Sí**, con holgura 7-12× |
| Medio (5k) | ~50-100 €/mes | 600 € | 1.350-1.600 € | ✅ **Sí**, con holgura 13-30× |
| Alto (20k) | ~50-300 €/mes | 3.000 € | 7.100-7.800 € | ✅ **Sí**, con holgura 23-150× |
| Sueño (100k) | ~340-1.300 €/mes | 15.000 € | 28.200-30.000 € | ✅ **Sí**, con holgura 22-87× |

**Conclusión**: a partir de **~300-500 usuarios registrados con ~30-50 Pro pagando**, los ingresos del freemium solo cubren los costes de infraestructura. **El break-even es sorprendentemente bajo.**

### 5.2 Break-even de "sueldo digno" (1.500 €/mes netos para Manu)

Asumiendo que el freemium v2 representa el 40-60% de los ingresos, necesitas:

- **~750-1.000 € MRR del Pro** = **~300-400 Pro pagando** (a 2,50 € ARPU).
- Combinado con ads/afiliación/newsletter (~500-700 €) llegas a 1.500 € totales.

A una tasa de conversión del 4%, **300 Pro = ~7.500 usuarios registrados**.

**Tiempo realista para llegar ahí con 1 dev solo, ejecutando las 4 patas en serio: 8-12 meses.**

### 5.3 Break-even incluyendo tiempo de Manu (€60/h × 80h/mes = 4.800 €/mes)

Para que el proyecto "pague" el tiempo del fundador a tarifa de mercado:

- Necesitas **~3.000-4.000 € MRR** (rentabilidad neta ~70% post-costes).
- Equivale a **~1.200-1.600 Pro pagando** o ~30-40k usuarios registrados.
- **Tiempo realista: 18-24 meses** (alineado con el "year 2" del plan freemium).

---

## 6. Análisis de rentabilidad: 2,99 € vs 4,99 € (precios actuales vs propuestos)

### 6.1 Sensibilidad de la conversión al precio

Datos de industria (ProfitWell, OpenView, ProductLed en freemium fitness):

| Precio mensual | Conversión esperada | ARPU | Comentario |
|---|---|---|---|
| **1,99 €** | 4-6% | ~1,90 € | Iguala ClubRunning, pierde justificación de valor. |
| **2,99 €** ⭐ | 3-5% | ~2,50 € | Sweet spot. 1 € sobre ClubRunning, 2 € bajo CorrerJuntos. |
| **3,99 €** | 2-3,5% | ~3,30 € | Empieza a friccionar la conversión. |
| **4,99 €** (actual) | 1,5-2,5% | ~4,10 € | Solo si la propuesta de valor es muy clara. |
| **5,99 €** | 1-2% | ~5 € | Out of segment para corredor popular. |

### 6.2 Modelado MRR a 5.000 usuarios registrados (escenario "medio")

| Precio | Conversión esperada | Pro | MRR (€) | ARR (€) | Coste de infra | Margen neto |
|---|---|---|---|---|---|---|
| **2,99 €** | 4% | 200 | **600 €** | 7.200 € | ~50-100 € | **~85%** |
| **3,99 €** | 2,5% | 125 | **500 €** | 6.000 € | ~50-100 € | **~85%** |
| **4,99 €** (actual) | 2% | 100 | **500 €** | 6.000 € | ~50-100 € | **~85%** |
| **4,99 €** (con plan anual 39 € + boost) | 2,5% | 125 | **520 €** | 6.240 € | ~50-100 € | **~85%** |

**Lectura**: a 5k usuarios, **2,99 € genera 20% más MRR que 4,99 €** porque la conversión casi se duplica. La diferencia neta se amplifica con la escala (a 20k usuarios, 2,99 € × 5% = 1.000 Pro vs 4,99 € × 2% = 400 Pro → **2,5× más MRR con el precio bajo**).

### 6.3 Plan anual: la palanca de LTV

| Plan | Precio | Fee Stripe | LTV a 5% churn mensual | Comentario |
|---|---|---|---|---|
| **Mensual 2,99 €** | 2,99 €/mes | 0,30 €/mes | ~50 € (sin anual) | Bajo compromiso, más churn real (8-10%). |
| **Anual 24 €** | 24 €/año (2 €/mes) | 0,30 € una vez | ~50 € (1 año lock-in) | Compromiso 12 meses, churn real menor (3-4%). |
| **Mensual 4,99 €** | 4,99 €/mes | 0,30 €/mes | ~85 € (sin anual) | Más alto, pero menos usuarios. |
| **Anual 39 €** | 39 €/año (3,25 €/mes) | 0,30 € una vez | ~67 € (1 año lock-in) | Margen bruto 98%. |

**El push de venta debe ser el anual.** El fee fijo de Stripe se diluye, y el LTV se asegura por 12 meses.

### 6.4 Recomendación de pricing

**Activa con 2,99 €/mes y 24 €/año, anual como push principal.**

- A 4,99 €, la justificación "más que ClubRunning (2 €), menos que CorrerJuntos (4,99 €)" **se rompe**: estás al mismo precio que CorrerJuntos pero con menos comunidad.
- A 2,99 €, te coloca **claramente entre dos competidores de referencia** con un pitch de valor diferencial (entrenador IA, diploma PDF, resultado oficial, hilo del corredor).
- El ARR esperado a 12 meses con 2,99 € es **20-150% mayor** que con 4,99 € según el escenario.

**Si decides mantener 4,99 €** (porque ya está configurado en Clerk):
- **Necesitas más features premium visibles** que justifiquen el delta de 2 € vs ClubRunning.
- **Acepta que la conversión va a ser 1,5-2%** y dispara el tráfico 2-3× para compensar.
- **El push de venta debe ser el anual a 39 €** (33% de ahorro aparente: "ahorra 20 € al año vs 4,99 €/mes").

---

## 7. Riesgos y decisiones pendientes

| # | Riesgo | Impacto | Mitigación | Cuándo decidir |
|---|---|---|---|---|
| 1 | **Conversión freemium <2%** | Alto (MRR 50% del esperado) | Trial 30 días sin tarjeta + medir uso real de features Pro en beta + ajustar pricing antes de lanzar público | Mes 1-2 (validación) |
| 2 | **Churn >10%/mes** | Alto (LTV cae a 12 meses) | Onboarding crítico: "wow moment" en 5-7 días (Strava → 1ª predicción → 1er diploma → 1er análisis IA) | Mes 2-3 (diseño onboarding) |
| 3 | **Vercel bandwidth se dispara con vídeos/PDFs** | Medio (costes suben 30-50%) | Limitar diplomas a descarga bajo demanda + comprimir PDFs + servir OG images con caché agresivo | Mes 1 (pre-activación) |
| 4 | **Resend 100/día limita growth** | Bajo-Medio | A los 1.500 MAU → upgrade a Pro $20/mes (50k emails) | Cuando se acerque |
| 5 | **Convex action compute se dispara con PDF + IA** | Medio | Limitar generación PDF + rate-limit IA a 4/mes/Pro (ya en freemium v2) | Mes 1 (pre-activación) |
| 6 | **Clerk no se mantiene <50k MRU** | Bajo | A 50k MRU el coste es $25/mes + $0,02/MRU. No es un blocker. | Cuando se acerque |
| 7 | **Dependencia de gpt-4o-mini** (cambios de precio) | Bajo | Migrable a MiniMax M3 u otro modelo en `lib/ai/pricing.ts`. Coste en €0 con M3 (ya verificado). | Trimestral |
| 8 | **Stripe fee mata margen micro-importes** | Bajo | 0,30 € fijo se diluye con el plan anual (24 €/año = 0,025 €/mes prorrateado) | Diseño pricing |
| 9 | **Stripe cambia pricing a 2,9% + 0,30 €** (IC++ en 2024-2025) | Bajo | Re-evaluar si pasa. A 2,99 € el fee sería 0,39 €, aún asumible. | Vigilar |
| 10 | **Competidores bajan precio** (ClubRunning a 1,99 €) | Bajo | Diferenciador: entrenador IA + diploma PDF + newsletter + SEO + resultado oficial. No compites en precio. | Vigilar |
| 11 | **RGPD / problemas legales con cobro** | Medio | Stripe cumple PCI-DSS. Clerk maneja datos. Auditoría anual con abogado (300-500 €). | Mes 6 (post-launch) |
| 12 | **Manu se quema** ejecutando 4 patas en paralelo | Alto (proyecto muere) | Priorizar: Pata 4 (Pro) > Pata 1 (AdSense) > Pata 3 (Newsletter) > Pata 2 (Afiliación). Las 4 en paralelo solo si hay tiempo. | Continuo |

---

## 8. Plan de acción 90 días

### Fase 0 (semana 1-2): Validación de pricing y setup

- [ ] **Validar pricing con 5-10 corredores reales** (no skippear). Pregunta: *"¿Pagarías 2,99 €/mes o 24 €/año por [lista de features Pro]? ¿Cuál te dolería más no tener?"*
- [ ] **Decidir pricing final**: ¿2,99 € o 4,99 €? Mi recomendación: **2,99 €** con anual destacado.
- [ ] **Activar Clerk Billing** siguiendo `BILLING_SETUP.md` (30-45 min la primera vez).
- [ ] **Setup de Resend Pro** ($20/mes) ANTES de activar el freemium si prevés >100 emails/día. Lo necesitarás desde el día 1.
- [ ] **Configurar rate limiting** del entrenador IA (4/mes) en `convex/aiUsageLog`.
- [ ] **Diseñar onboarding Pro**: "wow moment" en 5 minutos desde el primer login.

### Fase 1 (semana 3-5): Beta cerrada

- [ ] Tabla `subscriptions` ya creada. Webhook handler listo. Solo falta la UI.
- [ ] Páginas `/cuenta` y `/cuenta/suscripcion` con `<PricingTable />` de Clerk.
- [ ] Página pública `/pro` con feature list, FAQ, social proof.
- [ ] Banners contextuales en home/perfil cuando free se acerca al límite.
- [ ] Email transaccional de bienvenida al upgrade (Resend).
- [ ] **Beta cerrada con 50-100 early adopters** (lista newsletter + comunidad). Trial 30 días sin tarjeta.

### Fase 2 (semana 6-8): Iteración y feature gating

- [ ] Aplicar `<Paywall>` a: calendario>5, PRs>3, resultados>3, export ZIP, alertas, export calendario, widget público, comparativa, entrenador IA, gear, splits, polyline, hilo del corredor.
- [ ] **NO aplicar a**: predicciones, catálogo, voto, 8D, newsletter.
- [ ] Recoger feedback de beta. Medir: trial → paid, retención 7/30 días, features más usadas.
- [ ] Iterar pricing y feature set si hace falta.

### Fase 3 (semana 9-12): Lanzamiento público + aceleración

- [ ] **Lanzamiento público** del Pro: anuncio en newsletter, redes (@midorsal), Product Hunt.
- [ ] **Oferta launch**: 19 €/año el primer año (en vez de 24 €). Solo para los primeros 200. Crea urgencia.
- [ ] **Post en blog**: "Por qué Pro cuesta 2 € al mes y no 5 €" (transparencia con los datos de `aiUsageLog`).
- [ ] Activar **AdSense** (Pata 1) si tienes >5k visitas/mes. Solicitar 1-4 semanas antes.
- [ ] Unirse a **Awin + Daisycon** (Pata 2) y publicar 2-3 guías SEO de "mejores zapatillas para X".
- [ ] Confirmar newsletter semanal (Pata 3) → buscar primer patrocinio a 1.500+ suscriptores.
- [ ] **Objetivo fin de semana 12**: ~50-100 Pro pagando, ~150-400 €/mes MRR, ~250-500 €/mes total con las 4 patas.

### Mes 4-12: Aceleración y SEO

- [ ] Publicar 1-2 artículos SEO/semana ("mejores zapatillas trail", "cómo correr tu primera media maratón", etc.) → objetivo 20-40k visitas/mes a mes 6.
- [ ] Escalar newsletter a 2.000 suscriptores (mes 6) → 5.000 (mes 12).
- [ ] Empezar a evaluar **Mediavine** si llegas a 50k sesiones/mes.
- [ ] **Evaluar migración a Stripe directo** si MRR > €5.000/mes (ahorrar 0,7% de comisión de Clerk Billing).
- [ ] **Objetivo mes 12**: 1.000-1.500 € MRR total (alineado con escenario "Bueno" de `MONETIZATION_PLAN.md`).

---

## 9. Resumen ejecutivo en 1 minuto

> **mi-dorsal es viable financieramente con el stack actual**. Los costes de infraestructura son **sublineales** con el tráfico: empezarás gastando ~20 €/mes y a 100k usuarios gastarás ~500-1.000 €/mes.
>
> **Con el modelo freemium v2 (2,99 €/mes o 24 €/año)**, el break-even operativo se alcanza con **~30-50 Pro pagando** (≈ 1.000 usuarios registrados). El break-even de "sueldo digno" requiere **~300-400 Pro** (≈ 7.500 usuarios) y es alcanzable en 8-12 meses con 1 dev y 4 patas en serio.
>
> **El pricing actual configurado (4,99 €/mes / 39 €/año) es rentable** pero deja dinero sobre la mesa: a igualdad de tráfico, **2,99 € genera 20-150% más MRR** que 4,99 € porque la conversión casi se duplica.
>
> **El cuello de botella NO son los costes de infraestructura. Es la conversión a Pro y la velocidad de adquisición de tráfico SEO.** Ejecuta las 4 patas (Pro + AdSense + Afiliación + Newsletter) en paralelo con foco en SEO de contenidos, y el proyecto es **sostenible financieramente en 12-18 meses** y **paga un sueldo digno en 18-24 meses**.

---

## 10. Referencias y supuestos verificables

- **Tarifas Vercel Pro** (verificadas 2026-08 en `vercel.com/docs/pricing`): $20/seat/mes + $20 crédito, 1 TB bandwidth, 10M edge, 1M invocations. Overage: $0,15/GB bw, $2/M edge, $0,60/M invocations, $0,128/CPU-hr, $0,0106/GB-hr memory.
- **Tarifas Convex** (verificadas 2026-08 en `convex.dev/pricing`): Free/Starter $0/mes con 1M calls, 0,5 GB DB, 20 GB-hr action, 1 GB egress. Overage: $2,20/M calls, $0,22/GB DB, $0,033/GB file, $0,33/GB-hr action, $0,132/GB egress. Professional: $25/dev/mes.
- **Tarifas Clerk** (verificadas 2026-08 en `clerk.com/pricing`): Free hasta 50k MRU desde feb 2026. Pro $25/mes (anual) o $25/mes (mensual) con 50k MRU incluidos. Overage $0,02/MRU.
- **Tarifas Resend** (verificadas 2026-08 en `resend.com/pricing`): Free 3k emails/mes con cap 100/día. Pro $20/mes con 50k emails, overage $0,40/1k. Scale $90/mes con 100k emails, overage $0,90/1k.
- **Tarifas Stripe EU** (verificadas en `stripe.com/es/pricing`): 1,4% + 0,30 € para tarjetas EU estándar, 2,5% + 0,30 € para UK, 2,9% + 0,30 € para internacionales.
- **Tarifas OpenAI gpt-4o-mini** (verificadas en `lib/ai/pricing.ts`): $0,15/1M input, $0,60/1M output. Coach IA: ~€0,0007/llamada.
- **Conversión freemium nicho fitness** (ProductLed, ProfitWell, OpenView): 2-7%, asumimos 3-5% en year 1 para corredor popular español.
- **Comparables verificados 7-8 sep 2026**: ClubRunning Plus 2 €/mes (37k usuarios), CorrerJuntos 4,99 €/mes, Strava 5-12 €/mes, Garmin Connect+ 8,99 €/mes, Runna 14,99 €/mes.
- **Gasto medio corredor popular español** (estudio SEMED-Cinfa): 39,6 €/mes en deporte. Tu Pro a 2,99 €/mes = 7,5% de ese gasto.
- **Datos propios del proyecto**: 374+ carreras indexadas, dominio `mi-dorsal.com` en producción, 50k MAU en Clerk son gratis hasta feb 2026, etc.

---

*Última revisión: 8 de septiembre de 2026 · Re-revisar mensualmente con datos reales de `aiUsageLog` y dashboard de Clerk/Convex/Vercel/Resend.*
