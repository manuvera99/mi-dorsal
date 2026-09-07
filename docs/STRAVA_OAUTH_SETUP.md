# Setup manual: Strava OAuth (Ola 1)

> **Estado:** código listo, pendiente de configuración manual por Manu.
> **Tiempo estimado:** 20-30 minutos (la mayor parte esperando aprobación de Strava).
> **Coste:** Strava Summit subscription ≈ $5/mes (necesario para Standard Tier).

---

## 1. Crear la app en Strava

1. Ir a https://www.strava.com/settings/api
2. Click "Create App"
3. Rellenar:
   - **Application Name**: `mi-dorsal`
   - **Category**: `Web`
   - **Club**: dejarlo vacío
   - **Website**: `https://www.mi-dorsal.com`
   - **Application Description**: "Web para corredores populares. Catálogo de carreras, tracking de dorsales, resultados oficiales. Necesitamos acceso a actividades para detectar carreras y calcular PRs."
   - **Authorization Callback Domain**: `www.mi-dorsal.com`
4. Click "Create"
5. **Copiar y guardar**:
   - `Client ID` → será `STRAVA_CLIENT_ID`
   - `Client Secret` → será `STRAVA_CLIENT_SECRET`
   - (El Client Secret se muestra UNA SOLA VEZ. Si lo pierdes, regenera la app.)

## 2. Aplicar al Standard Tier (rate limits)

Por defecto, una app nueva solo puede tener 1 atleta conectado. Para producción:

1. Ir a la página de la app recién creada
2. Click en "Upgrade to Standard Tier" o similar
3. **Requisito**: tener Strava Summit (~$5/mes)
4. Esperar aprobación (normalmente inmediato, a veces tarda horas)

Con Standard Tier:
- Hasta 10 atletas conectados
- 200 req/15min, 2.000/día en read endpoints
- Acceso a streams detallados (GPS, HR, cadence segundo a segundo)

> ⚠️ Si no quieres pagar Summit, deja la app en tier free. Funcionará igual para 1 atleta (tú mismo para probar). Cuando crezcas y tengas más usuarios, decides si pagar o usar el plan free + invitar a un atleta a la vez.

## 3. Configurar webhook callback URL

El cron `renew-strava-webhook` (cada 12h) crea/renueva la suscripción automáticamente vía `POST /push_subscriptions` — no hace falta crearla a mano en el panel de Strava.

> ⚠️ **Corrección (verificado 2026-09-07)**: la API real de Strava NO devuelve ningún "Webhook Secret" al crear la suscripción — el POST solo devuelve `{ id }`. No existe `STRAVA_WEBHOOK_SECRET`. La única validación disponible es el `verify_token` que la propia app elige al crear la suscripción (hardcodeado como `VERIFY_TOKEN` en `convex/actions/stravaWebhookSubscription.ts` y `app/api/webhooks/strava/route.ts` — debe coincidir en ambos), y que Strava devuelve en `hub.verify_token` durante el GET de validación inicial.

> 💡 El `STRAVA_WEBHOOK_CALLBACK_URL` es el que usará la action de renovación para re-suscribir. Configúralo como env var (en Vercel Y en Convex — son runtimes separados) para que el cron funcione.

## 4. Generar `STRAVA_TOKEN_KEY` (cifrado AES-256-GCM)

Los tokens de Strava son credenciales. RGPD: deben estar cifrados en reposo.

```bash
cd C:\desarrollo\mi-dorsal
npx tsx scripts/generate-strava-key.ts
```

Copia la versión base64 (recomendada) y guárdala como `STRAVA_TOKEN_KEY`.

> ⚠️ **MUY IMPORTANTE**: si pierdes esta clave, los tokens de Strava existentes son irrecuperables y los usuarios tendrán que re-conectar. Guarda una copia en un gestor de contraseñas seguro (1Password, Bitwarden, etc.).

## 5. Variables de entorno a añadir

**Importante**: hay que configurarlas en DOS sitios, no solo en Vercel. Las actions de sync/webhook/renovación corren en el runtime de Convex, no en Next.js, así que Convex necesita su propia copia de estas variables (`npx convex env set NOMBRE --prod`, o `npx convex env list --prod` para verificar qué hay). Vercel y Convex no comparten env vars automáticamente.

En Vercel (`Settings → Environment Variables → Add` para `production`) **y** en Convex (`npx convex env set ... --prod`):

| Variable | Valor | Notas |
|---|---|---|
| `STRAVA_CLIENT_ID` | (de Strava) | El Client ID de la app |
| `STRAVA_CLIENT_SECRET` | (de Strava) | El Client Secret |
| `STRAVA_WEBHOOK_CALLBACK_URL` | `https://www.mi-dorsal.com/api/webhooks/strava` | Para que el cron de renovación funcione |
| `STRAVA_TOKEN_KEY` | (generada en paso 4) | Clave de cifrado AES-256-GCM |
| `NEXT_PUBLIC_APP_URL` | (ya debe estar) `https://www.mi-dorsal.com` | Usado para construir el redirect_uri OAuth (solo Vercel/Next.js) |

En `.env.local` para dev:

```bash
STRAVA_CLIENT_ID=123456
STRAVA_CLIENT_SECRET=abc123def456...
STRAVA_WEBHOOK_CALLBACK_URL=https://mi-dorsal.vercel.app/api/webhooks/strava
STRAVA_TOKEN_KEY=<clave base64 generada>
NEXT_PUBLIC_APP_URL=http://localhost:3000  # o tu URL de dev
```

> 💡 Para dev, el callback de Strava puede ser tu URL de Vercel (preview) o un dominio que Strava acepte. La forma más fácil es deployar primero a Vercel y luego usar la URL de producción o preview para crear la app en Strava.

## 6. Deploy

Una vez las env vars están en Vercel:

```bash
cd C:\desarrollo\mi-dorsal
npx convex deploy    # backend
vercel deploy --prod --force --yes  # frontend
```

Verificar:
- `/perfil` → debería verse el botón "Conectar con Strava"
- Click → redirige a Strava
- Aceptar → vuelve a `/perfil?strava=connected`
- En la card de Strava debería verse "✓ Conectado"

## 7. Smoke test end-to-end

1. Login con Clerk en `https://www.mi-dorsal.com`
2. `/perfil` → click "Conectar con Strava"
3. Autorizar en Strava
4. Volver a `/perfil` → debería verse "Conectado, sincronizando…"
5. Esperar 1-2 min (depende de cuántas actividades tengas)
6. Verificar en Convex Dashboard:
   - `activities` con `provider = "strava"` debe tener N filas
   - `personalRecords` debe tener PRs nuevos si batiste récords
7. Subir una actividad nueva a Strava (o actualizar una existente)
8. Esperar 1-2 min → debería aparecer en `activities` vía webhook

## 8. Si algo falla

### "redirect_uri_mismatch" en Strava

El `Authorization Callback Domain` de la app en Strava debe coincidir con el host del `redirect_uri`. Si tu callback es `https://www.mi-dorsal.com/api/connect/strava/callback`, el dominio autorizado debe ser `www.mi-dorsal.com` (sin path).

### "invalid_client" o "unauthorized"

`STRAVA_CLIENT_ID` o `STRAVA_CLIENT_SECRET` mal copiados. Verifica en el panel de Strava.

### Webhook no se activa

Strava exige que el endpoint responda al challenge GET. Verificar que `GET /api/webhooks/strava?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...` devuelve 200 con `{"hub.challenge": "..."}`. Se puede probar con curl.

### Token expirado o inválido

El helper `ensureFreshToken` refresca automáticamente. Si el refresh falla (refresh token revocado), el usuario verá un error. La solución: que desconecte y vuelva a conectar.

### Actividad nueva en Strava no aparece

1. Verificar en Convex Dashboard que el webhook está suscrito (`STRAVA_WEBHOOK_SUBSCRIPTION_ID` o en la página de Strava).
2. Verificar logs de Vercel para `app/api/webhooks/strava`: `vercel logs mi-dorsal --since 1h | grep strava`.
3. Si no hay eventos, el cron de renovación debería haber resuscrito. Forzar: `vercel logs mi-dorsal --since 24h | grep renew-strava`.

## 9. Roadmap post-Ola 1

- **Ola 2**: tipo de corredor con heurísticas (reusa `convex/activities/normalize.ts` que ya está compartido).
- **Garmin**: cuando reabran el Developer Program. La arquitectura está lista, solo hay que añadir un `lib/garmin/client.ts` análogo a `lib/strava/client.ts` y un nuevo oauth flow.
- **Múltiples atletas**: Standard Tier limita a 10. Cuando llegues a 10 usuarios conectados, hay que pedir Extended Access Tier (gratis pero requiere申请).

---

*Si tienes dudas durante el setup, mira los logs con `vercel logs mi-dorsal --since 1h` o `npx convex dashboard`.*
