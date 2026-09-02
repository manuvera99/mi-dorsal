# 🚀 DEPLOY en 25 minutos — Guía paso a paso

> **Importante:** Yo (Mavis) no puedo hacer el deploy por ti. Necesito que TÚ crees las cuentas y copies las API keys. Pero te dejo todo el código 100% listo y esta guía para que sea lo más rápido posible.

---

## ⏱ Tiempo estimado: 25 minutos total

| Paso | Acción | Tiempo |
|---|---|---|
| 1 | Subir código a GitHub | 2 min |
| 2 | Crear cuenta Clerk (auth) | 5 min |
| 3 | Crear cuenta Convex (backend) | 5 min |
| 4 | Crear cuenta Resend (emails) | 2 min |
| 5 | Crear cuenta Vercel y desplegar | 8 min |
| 6 | Verificar que todo funciona | 3 min |

---

## 📋 Pre-requisitos

- [ ] Cuenta de GitHub (si no tienes, créala en https://github.com)
- [ ] Email válido
- [ ] Tarjeta de crédito/débito (NO se cobra nada, todos los tiers free son gratis)
- [ ] El proyecto `mi-dorsal` está en `C:\desarrollo\mi-dorsal\` ✅ (ya listo)

---

## Paso 1: Subir código a GitHub (2 min)

Abre una terminal en `C:\desarrollo\mi-dorsal` y ejecuta:

```powershell
git init
git add -A
git commit -m "Initial commit: mi-dorsal MVP"
gh repo create mi-dorsal --public --source=. --push
```

> Si no tienes `gh` instalado, ve a https://github.com/new, crea el repo `mi-dorsal` (público), y luego:
> ```powershell
> git remote add origin https://github.com/TU-USUARIO/mi-dorsal.git
> git branch -M main
> git push -u origin main
> ```

✅ **Checklist:** El código está en `https://github.com/TU-USUARIO/mi-dorsal`

---

## Paso 2: Crear cuenta Clerk (5 min) — Auth

1. Ve a https://dashboard.clerk.com → **Sign up**
2. Crea una aplicación (nombre: "mi-dorsal", cualquier framework)
3. En **Configure → Email, Phone, Username**:
   - Activa **Email address** → **Email link** (magic link)
4. En **API Keys** (esquina superior izquierda), copia:
   - `Publishable key` → lo necesitarás como `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret key` → lo necesitarás como `CLERK_SECRET_KEY`
5. En **JWT Templates** (menú lateral):
   - **New template** → **Convex**
   - Copia el **Issuer** (algo como `https://your-app-12.clerk.accounts.dev`)
   - Este es tu `CLERK_JWT_ISSUER_DOMAIN`

> 💡 **Tip:** Deja la pestaña abierta, volveremos aquí en el paso 5.

✅ **Checklist:**
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (empieza con `pk_test_...`)
- [ ] `CLERK_SECRET_KEY` (empieza con `sk_test_...`)
- [ ] `CLERK_JWT_ISSUER_DOMAIN` (URL tipo `https://...clerk.accounts.dev`)

---

## Paso 3: Crear cuenta Convex (5 min) — Backend

1. Ve a https://dashboard.convex.dev → **Sign up with GitHub**
2. Click **Create Project** → nombre "mi-dorsal" → click **Create**
3. Copia el **Deployment URL** (algo como `https://relaxed-otter-123.convex.cloud`)
   - Este es tu `NEXT_PUBLIC_CONVEX_URL`
4. **Abre una terminal** en `C:\desarrollo\mi-dorsal` y ejecuta:
   ```powershell
   npx convex dev
   ```
   - Te pedirá login → autorízalo con GitHub
   - Te preguntará el proyecto → selecciona "mi-dorsal"
   - **NO CIERRES esta terminal** — déjala corriendo. Sincroniza el schema automáticamente.
5. En otra terminal, verifica que el deploy funcionó. En la primera terminal debería decir algo como:
   ```
   ✔ Synced schema, functions
   ```
6. Vuelve a la **dashboard de Convex** en el navegador:
   - **Settings** (icono engranaje abajo a la izquierda) → **Environment Variables**
   - Click **Add Variable**:
     - Name: `CLERK_JWT_ISSUER_DOMAIN`
     - Value: el mismo valor que copiaste de Clerk
   - Click **Save**

> 💡 **Tip:** El nombre del proyecto Convex y el "deployment name" pueden ser distintos. En la primera terminal `npx convex dev` te dice el nombre real.

✅ **Checklist:**
- [ ] `NEXT_PUBLIC_CONVEX_URL` (URL tipo `https://....convex.cloud`)
- [ ] `CLERK_JWT_ISSUER_DOMAIN` configurado en Convex Dashboard

---

## Paso 4: Crear cuenta Resend (2 min) — Emails

1. Ve a https://resend.com → **Sign up** (con GitHub)
2. Click **API Keys** (menú lateral) → **Create API Key**
   - Name: "mi-dorsal"
   - Permission: "Sending access"
3. Copia la key (empieza con `re_...`) → este es tu `RESEND_API_KEY`
4. **Para testing rápido** (sin verificar dominio), usa:
   - `RESEND_FROM_EMAIL=onboarding@resend.dev`

> 💡 **Tip:** Cuando quieras usar tu dominio real (`resultados@mi-dorsal.es`), ve a **Domains** → añade `mi-dorsal.es` y configura el DNS. Tarda 5-10 min en propagarse.

✅ **Checklist:**
- [ ] `RESEND_API_KEY` (empieza con `re_...`)
- [ ] `RESEND_FROM_EMAIL` (por ahora `onboarding@resend.dev`)

---

## Paso 5: Desplegar en Vercel (8 min)

### 5.1 Crear cuenta y conectar repo

1. Ve a https://vercel.com → **Sign up with GitHub**
2. Click **Add New... → Project**
3. Busca `mi-dorsal` en la lista de repos → click **Import**

### 5.2 Configurar variables de entorno

En la pantalla de configuración del proyecto, busca la sección **Environment Variables**.

Añade TODAS estas variables (copia-pegando desde donde las anotaste):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `https://....convex.cloud` |
| `CONVEX_DEPLOYMENT` | `prod:mi-dorsal` (o el nombre que te dijo `npx convex dev`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` |
| `CLERK_JWT_ISSUER_DOMAIN` | `https://...clerk.accounts.dev` |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` |
| `NEXT_PUBLIC_APP_URL` | `https://mi-dorsal.vercel.app` (o tu dominio) |
| `NEXT_PUBLIC_USE_MOCK` | `false` |

### 5.3 Deploy

1. Click **Deploy**
2. Espera 2-3 minutos (verás un log de build)
3. Cuando termine, te da una URL tipo `https://mi-dorsal-xyz.vercel.app`
4. Click en **Visit** para abrir la app

> ⚠️ **Si el build falla**, abre los logs. Lo más común:
> - Falta alguna env var → vuelve a Environment Variables
> - Error de TypeScript → coméntamelo, lo arreglo

✅ **Checklist:**
- [ ] App desplegada en `https://mi-dorsal-xxx.vercel.app`
- [ ] Build OK (sin errores en logs)

---

## Paso 6: Configurar dominios autorizados (3 min)

### En Clerk

1. Ve a https://dashboard.clerk.com → tu app **mi-dorsal**
2. **Configure → Domains**
3. Click **Add domain**:
   - Domain: `mi-dorsal-xxx.vercel.app` (o tu dominio custom)
4. Guarda

### En Convex (verificar que Clerk está conectado)

1. Ve a https://dashboard.convex.dev → tu proyecto
2. **Settings → Authentication**
3. Verifica que el JWT template de Clerk está añadido (lo hiciste en el paso 2)

---

## Paso 7: Verificar end-to-end (3 min)

Abre tu app desplegada y comprueba:

- [ ] **Home carga** con carreras destacadas
- [ ] **Catálogo** muestra las 12-29 carreras
- [ ] **Click en una carrera** → ficha completa con todos los datos
- [ ] **Botón "INSCRIBIRSE"** → abre la URL externa de inscripción
- [ ] **Sign in** con tu email → recibes magic link
- [ ] **Vota una carrera** con 👍 → el contador sube
- [ ] **Calendario** → puedes añadir carreras

---

## 🚨 Troubleshooting

### "Could not find Convex client"
- Verifica que `NEXT_PUBLIC_CONVEX_URL` está bien copiada
- Asegúrate de que el `npx convex dev` está corriendo

### "Unauthorized" al votar
- El `CLERK_JWT_ISSUER_DOMAIN` no coincide entre Clerk y Convex
- En Convex Dashboard, **Settings → Environment Variables**, verifica que el valor es EXACTO

### Build falla en Vercel con "Module not found"
- Falta `npm install` o alguna dependencia
- Revisa que `package-lock.json` está commiteado

### Los emails no llegan
- En Resend, verifica que la API key es correcta
- Si usas `onboarding@resend.dev`, revisa la carpeta SPAM
- Para producción, verifica tu dominio en Resend → Domains

### "Page not found" en Vercel
- Verifica que el `Framework Preset` en Vercel es **Next.js** (no otro)
- Settings → General → Framework Preset → Next.js

---

## 🎁 Bonus: subir las 29 carreras scraped a Convex

Una vez deployed, abre una terminal en `C:\desarrollo\mi-dorsal` y:

```powershell
# Asegúrate de tener .env.local con NEXT_PUBLIC_CONVEX_URL configurado
npm run ingest:to-convex
```

Verás algo como:
```
[ingest-to-convex] 29 carreras a subir a Convex...
.............................
[ingest-to-convex] ✅ 29 carreras subidas
```

Ahora aparecerán en producción también. 🎉

---

## 📞 Si te atascas

Dime exactamente:
1. **En qué paso estás**
2. **Qué error te sale** (copia-pega el texto o screenshot)
3. **Qué URL del paso falló**

Y te ayudo a debuggear en tiempo real.

---

## 🗺️ Resumen de URLs que necesitas

| Servicio | URL | Lo que obtienes |
|---|---|---|
| GitHub | https://github.com | Repo público con tu código |
| Clerk | https://dashboard.clerk.com | 3 API keys |
| Convex | https://dashboard.convex.dev | 1 URL + 1 issuer |
| Resend | https://resend.com | 1 API key |
| Vercel | https://vercel.com | 1 deploy URL |
| **Tu app** | `https://mi-dorsal-xxx.vercel.app` | **🎉 Lista** |

---

**Tiempo total real: 25-30 min si no te atascas. Más si es la primera vez con alguna de estas plataformas.**
