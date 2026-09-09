# Naming, marca y dominio — decisiones del 4 sep 2026

> Documento histórico. Se carga solo cuando se toca naming, dominios, OEPM, o copy relacionado con la marca.

## Conflictos de marca analizados (verificados con WHOIS/RDAP)

| Nombre | URL | Estado | Amenaza |
|---|---|---|---|
| **Midorsal** | `midorsal.com` (B2B Toledo) | REGISTRADO | 🔴 ALTA — competidor directo, misma raíz semántica |
| DorsalChip | `dorsalchip.es` | REGISTRADO | 🟠 Media (cronometraje, no competidor) |
| Dorsal1 | `dorsal1.es` | REGISTRADO | 🟠 Media (cronometrador regional) |
| Dorsal21 | `dorsal21.com` | REGISTRADO | 🟠 Media (cronometrador Murcia) |
| Dorsal.pro | `dorsal.pro` | REGISTRADO | 🟢 Baja (marketplace dorsales) |
| BuscoDorsal | `buscodorsal.com` | REGISTRADO | 🟢 Baja (fotos por dorsal) |
| #MiDorsal | hashtag cultural en sector | — | 🟢 A FAVOR — ya está asumido por la comunidad |

**Conclusión**: nadie usa "dorsal" como marca emocional/personal del corredor popular. Esa es nuestra ventana. La convivencia con `midorsal.com` es inevitable, pero diferenciable por audiencia (B2B organizadores vs B2C corredores).

## Decisión final sobre naming

**Se mantiene `mi-dorsal` (con guion). NO se rebrandea.**

Razones:
- Brandability / boca-oreja: el activo cultural del hashtag #MiDorsal es IRREPETIBLE
- SEO a 36+ meses: la convivencia con `midorsal.com` se separa por audiencia distinta
- Coste de cambiar >> coste de coexistir (200 € proteger vs 20.000 € rebrandear)
- Defensibilidad legal aceptable con OEPM clase 9/41/42 + dominio `.com` con guion

**Plan B documentado** por si en 12-18 meses toca rebrandear: Carrerómetro, Dorsalink, Dorsalio, Meta del Dorsal, El Hilo. Todos con `.com` y `.run` verificados LIBRES (WHOIS/RDAP 4 sep 2026). NO ACTIVAR sin discusión.

## Dominios comprados y propagación (4 sep 2026)

| Dominio | Registrador | Precio/año | Estado |
|---|---|---|---|
| **mi-dorsal.com** | Vercel | ~10 € | ✅ COMPRADO + LIVE (apunta a producción) |
| **mi-dorsal.es** | Hostinger | ~9 € | ✅ COMPRADO + DNS configurado, propagando |
| `mi-dorsal.run` | — | ~24 € | ⬜ Pendiente, defensivo (extensión del sector) |
| `mi-dorsal.app` | — | ~18 € | ⬜ Pendiente, defensivo (formato app) |

**Setup DNS en Hostinger (4 sep 2026)**:
- Registro A: `mi-dorsal.es` → `76.76.21.21` (Vercel)
- Registro CNAME: `www` → `cname.vercel-dns.com` (⚠️ conflicto con default de Hostinger, ver §"Inconsistencias")
- TTL: 14400 (estándar, OK)

**Setup Vercel**: `mi-dorsal.com`, `www.mi-dorsal.com` y `mi-dorsal.vercel.app` → Valid Configuration. Redirect 308: `mi-dorsal.com` → `www.mi-dorsal.com`.

## Email corporativo pendiente

**Decisión**: configurar **Zoho Mail plan Free** (5 buzones gratis) vinculado a `mi-dorsal.es`. NO pagar el pack email de Hostinger (10 € extra) ni Google Workspace (72 €/año) ni Microsoft 365 (50 €/año).

**Pasos a ejecutar** (15 min):
1. https://www.zoho.com/mail/ → Sign Up → plan Free
2. Add domain: `mi-dorsal.es`
3. Zoho da TXT de verificación → añadir en Hostinger DNS:
   - Tipo: TXT, Host: `@`, Valor: el de Zoho
4. Verify dominio en Zoho (espera 5-10 min)
5. Zoho da MX records → añadir en Hostinger DNS:
   - Tipo: MX, Host: `@`, Prioridad: 10, Valor: `mx.zoho.com`
6. Crear buzón `info@mi-dorsal.es`
7. Conectar vía IMAP a Gmail/Outlook/Apple Mail

**Buzones a crear** (3-4 para empezar):
- `info@mi-dorsal.es` — contacto general, fallback
- `hola@mi-dorsal.es` — email de bienvenida, onboarding
- `noreply@mi-dorsal.es` — emails transaccionales (solo envío)
- `soporte@mi-dorsal.es` — cuando escales a tener usuarios que pidan ayuda

**Actualizar el email en código** cuando esté activo: el `app/layout.tsx` actual declara `hola@mi-dorsal.es` (JSON-LD Organization) — verificar que el buzón exista o cambiar a `info@mi-dorsal.es`.

## Inconsistencias de naming detectadas en el código (pendiente)

Detectado el 4 sep 2026 en `mi-dorsal-6besvjgpy-manuvera99s-projects.vercel.app` (HTML inspeccionado):

| Lugar | Versión actual | Decisión recomendada |
|---|---|---|
| `og:site_name` | "mi-dorsal" | ✅ Dejar (con guion) |
| `twitter:site` | "@midorsal" | ✅ Dejar (sin guion — los handles no admiten guion y la gente no los escribe) |
| `twitter:creator` | "@midorsal" | ✅ Dejar |
| `application-name` | "mi-dorsal" | ✅ Dejar |
| `apple-mobile-web-app-title` | "mi-dorsal" | ✅ Dejar |
| Email contacto declarado | `hola@mi-dorsal.es` | ⚠️ Pendiente: crear buzón o cambiar a `info@mi-dorsal.es` |
| Copy de la home: "Enero. Abres midorsal." | sin guion | ⚠️ Cambiar a "Enero. Abres mi-dorsal." o "Abres la app." (evita inconsistencia) |

**Regla de consistencia** (aplicar cuando se toque):
- **URLs, dominios, emails**: `mi-dorsal` (con guion)
- **Handles de redes sociales**: `@midorsal` (sin guion)
- **Copy en pantalla**: `mi-dorsal` (con guion, como el wordmark del logo)
- **Hashtags**: `#MiDorsal` (CamelCase para legibilidad)

## Pendientes inmediatos (orden de prioridad)

1. 🔴 Configurar Zoho Mail (15 min, 0 €) — ver sección "Email corporativo" arriba
2. 🟠 Verificar que `mi-dorsal.es` ya resuelve en navegador (espera 5-30 min desde DNS en Hostinger)
3. 🟠 Limpiar inconsistencias de naming en código (30 min) — ver tabla arriba
4. 🟠 Registrar marca en OEPM clases 9/41/42 (1h + 8-12 meses resolución, ~150€) — no hay checklist externa, este documento es la referencia
5. 🟢 Comprar `mi-dorsal.run` defensivo (~24 €/año) cuando apetezca
6. 🟢 Asegurar `@midorsal` en IG, TikTok, X, YouTube, Threads, Bluesky (15 min, 0 €)
7. 🟢 Logo simplificado para favicons (gap técnico en `public/`)
