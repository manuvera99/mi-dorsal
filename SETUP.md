# Setup — mi-dorsal

> **Estado actual:** App funcionando en modo MOCK en `http://localhost:3001`
> Todas las páginas devuelven 200, los datos son de ejemplo (12 carreras del Levante).

---

## ⏱ 30 minutos para tener la app en Vercel

Lo que necesitas hacer (en orden):

### 1. Crear cuenta en Clerk (5 min) — auth

1. Ve a https://dashboard.clerk.com → Sign up
2. Crea una aplicación nueva (cualquier nombre, ej "mi-dorsal-dev")
3. Configura sign-in con **Email magic link** (Settings → Email, Phone, Username → Email address → Email link)
4. Copia las API Keys a `.env.local`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Publishable key)
   - `CLERK_SECRET_KEY` (Secret key)
5. **Importante para Convex:** JWT Templates → New → Convex
   - Copia el "Issuer" URL (algo como `https://your-app-12.clerk.accounts.dev`)
   - Pégalo como `CLERK_JWT_ISSUER_DOMAIN` en `.env.local`
6. Configura las rutas de sign-in/sign-up (en `.env.local` ya están por defecto)

### 2. Crear proyecto en Convex (5 min) — backend

1. Ve a https://dashboard.convex.dev → Sign up (con GitHub)
2. Create Project → nombre "mi-dorsal"
3. Copia el **Deployment URL** → `NEXT_PUBLIC_CONVEX_URL` en `.env.local`
4. En la terminal del proyecto:
   ```bash
   npx convex dev
   ```
   Esto sincroniza `convex/schema.ts` con tu deployment. Déjalo corriendo en otra terminal.
5. Vuelve a la dashboard de Convex → Settings → Environment Variables:
   - Añade `CLERK_JWT_ISSUER_DOMAIN` con el mismo valor que en Clerk

### 3. Configurar Resend (3 min) — emails

1. Ve a https://resend.com → Sign up
2. Create API Key → `RESEND_API_KEY` en `.env.local`
3. (Opcional) Verifica tu dominio. Para dev, usa el dominio de testing que te da Resend.
4. `RESEND_FROM_EMAIL` = `onboarding@resend.dev` (testing) o tu dominio verificado

### 4. Variables de entorno finales (2 min)

Tu `.env.local` debería verse así:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=prod:your-project

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-app-12.clerk.accounts.dev
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/calendario
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/calendario

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_USE_MOCK=false
```

**Cambia `NEXT_PUBLIC_USE_MOCK` a `false`** cuando todo lo demás esté configurado.

### 5. Probar localmente (5 min)

```bash
# Terminal 1: Convex dev
npx convex dev

# Terminal 2: Next.js dev
npm run dev
```

Abre http://localhost:3000 y:
- Regístrate con tu email
- Añade un PR (perfil)
- Ve a carreras, marca una como "voy a correrla"
- Vota una carrera con los 8 sliders

### 6. Desplegar a Vercel (10 min)

1. Sube el código a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create mi-dorsal --public --source=. --push
   ```
   (O crea el repo manualmente en github.com y haz push)

2. Ve a https://vercel.com → Sign up with GitHub
3. Import Project → selecciona `mi-dorsal`
4. En "Environment Variables", añade TODAS las del `.env.local` (sin el prefijo `NEXT_PUBLIC_` privado)
5. Click "Deploy"
6. Espera 2-3 minutos → tu app está en `https://mi-dorsal.vercel.app`

7. (Importante) Vuelve a Clerk y añade la URL de Vercel como allowed origin.

8. (Importante) En Convex dashboard, no tienes que hacer nada extra — el deployment prod se actualiza automáticamente.

### 7. Configurar cron jobs (en Vercel)

Los 4 cron jobs ya están definidos en `convex/crons.ts`. Se ejecutan automáticamente en el deployment de Convex. No necesitas configurar nada extra.

Para verificar: ve a Convex Dashboard → Logs → busca "check-results", "reminder-pre-race", etc.

---

## 🧪 Modo MOCK (lo que está corriendo ahora)

`NEXT_PUBLIC_USE_MOCK=true` permite que la app funcione sin Clerk/Convex. Usa datos estáticos de `lib/mock/data.ts`:
- 12 carreras del Levante (15K Nocturna Valencia, Media Albacete, Media Valencia, etc.)
- 3 PRs ficticios (Manu: 5K 23:46, 10K 47:20, Media 1:57:43)
- 3 carreras en el calendario personal
- Ratings ficticios en algunas carreras

Esto es perfecto para:
- Demos sin credenciales
- Previews en Vercel antes de tener Clerk/Convex
- Testing de UI

Para producción: `NEXT_PUBLIC_USE_MOCK=false`.

---

## 🐛 Troubleshooting

### "Could not find Convex client" en producción

Asegúrate de que `NEXT_PUBLIC_USE_MOCK=false` y que `NEXT_PUBLIC_CONVEX_URL` está en Vercel env vars.

### "Unauthorized" al usar Clerk

1. Verifica que `CLERK_SECRET_KEY` y `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` están en Vercel env vars
2. En Clerk dashboard, añade la URL de Vercel como allowed origin

### "Invalid token" en Convex

1. Verifica que `CLERK_JWT_ISSUER_DOMAIN` está en Convex dashboard (no solo en `.env.local`)
2. Reinicia `npx convex dev` después de cambiar el issuer

### Predicciones muy desviadas

El algoritmo es Daniels VDOT con ajustes. Si tu PR es muy reciente o de una distancia muy diferente, el error puede ser alto. El sistema muestra confianza (`low`/`medium`/`high`) para que sepas.

### El cron `check-results` no encuentra tu dorsal

El scraper es un adapter genérico que busca tablas HTML con tu dorsal. Si el cronometrador tiene un HTML muy distinto, hay que escribir un adapter específico. Mira `convex/scraper.ts` y añade uno nuevo.

---

## 📞 Si te atascas

Abre una issue en el repo o pásame el error exacto y te ayudo a debuggear.
