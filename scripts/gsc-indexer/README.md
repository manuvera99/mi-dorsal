# gsc-indexer · pedir indexación en masa a Google

Script para pedir a Google que indexe URLs concretas de mi-dorsal.com
usando la **URL Inspection API** de Google Search Console.

Útil tras un deploy grande o cuando añades carreras nuevas y quieres
acelerar el descubrimiento.

## Hay 2 modos de autenticación

| Modo | Cuando usarlo | Setup |
|---|---|---|
| **OAuth** (recomendado para 1 persona) | Tienes tu Gmail, no quieres tocar GCP mas que para crear 1 client | 5 min, 1 sola vez |
| **service-account** | CI/CD, uso recurrente, no quieres login humano | 10 min, 1 sola vez |

El script auto-detecta: si existe `credentials.json` usa service account;
si no, usa OAuth.

---

## MODO OAuth (recomendado — 5 min una sola vez)

### 1. Crear OAuth Client en GCP

1. https://console.cloud.google.com/apis/credentials
2. Tu proyecto → **+ Create Credentials** → **OAuth client ID**
3. Si te pide configurar pantalla de consentimiento OAuth, pon:
     - User type: **External**
     - App name: `gsc-indexer-mi-dorsal`
     - Tu email en soporte y developer
     - Scopes: añadir `https://www.googleapis.com/auth/webmasters`
     - Test users: añadir **tu Gmail**
     - **Save**
4. Vuelve a Credentials → **+ Create Credentials** → **OAuth client ID**
5. Application type: **Desktop app**
6. Name: `gsc-indexer-mi-dorsal`
7. **Create** → **Download JSON** → guardar como
   `scripts/gsc-indexer/oauth-client.json`

### 2. Habilitar la API

```powershell
# (Si no tienes gcloud, saltate este paso y hazlo desde la consola de GCP)
gcloud services enable searchconsole.googleapis.com --project=TU-PROJECT-ID
```

O desde GCP console: APIs & Services → Library → buscar "Search Console API" → Enable.

### 3. Login (una sola vez)

```powershell
cd scripts\gsc-indexer
npm install
node login.mjs
```

Esto:
- Abre tu navegador en la pantalla de Google
- Login con tu Gmail (debe estar en "Test users" del paso 1)
- Acepta el scope webmasters
- Cierra la ventana solo

Vuelve a la terminal: veras `✓ Login completado.`

### 4. Generar URLs y correr

```powershell
$env:SITE_URL="https://www.mi-dorsal.com"
node fetch-urls-from-sitemap.mjs   # urls.txt con top 200
node index.mjs                     # pide indexación
```

> `token.json` se guarda con tu refresh_token. No caduca salvo que revoques.
> Solo necesitas `login.mjs` UNA vez por maquina.

---

## MODO service-account (alternativa)

### 1. Crear service account en GCP

1. https://console.cloud.google.com/iam-admin/serviceaccounts
2. Tu proyecto → **+ Create Service Account**
3. Nombre: `gsc-indexer-mi-dorsal`
4. Rol: **ninguno**
5. **Done** → click en el SA → **Keys** → **Add Key** → **Create new** →
   **JSON** → guardar como `credentials.json`

### 2. Dar permiso en GSC

1. https://search.google.com/search-console
2. Settings → **Users and permissions**
3. **Add user** → pegar el `client_email` del JSON
4. Permission: **Owner**

### 3. Correr

```powershell
cd scripts\gsc-indexer
npm install
$env:SITE_URL="https://www.mi-dorsal.com"
$env:AUTH_MODE="service-account"
node fetch-urls-from-sitemap.mjs
node index.mjs
```

---

## Uso común

### Generar `urls.txt` desde el sitemap

```powershell
$env:SITE_URL="https://www.mi-dorsal.com"
node fetch-urls-from-sitemap.mjs
# Para solo 20 URLs (test):
$env:MAX="20"; node fetch-urls-from-sitemap.mjs
```

El script ordena por prioridad (fichas de carreras primero) y `lastmod` DESC.

### Qué hace cada URL

1. **Inspecciona** el estado actual en GSC via URL Inspection API
2. Loguea el resultado en `results.csv` (verdict, coverage_state, indexing_state)

## Limitación importante (2024+)

Google **removió** el endpoint `urlInspection.index:requestIndexing` como
API pública en algún momento de 2024. La doc oficial devuelve 404 y no
hay forma programática de pedir indexación.

**Opciones para acelerar indexación**:

1. **Manual en GSC**: pegar URL en `https://search.google.com/search-console/inspect`
   y clicar "Solicitar indexación". Limite: ~10-15 URLs/día por propiedad.
2. **Ping via sitemap**: el script ya está hecho — `fetch-urls-from-sitemap.mjs`
   genera `urls.txt` desde el sitemap para que el inspector las recorra.
   Cuando Google las inspeccione vía este script, las marca como "urlIsKnown"
   y empiezan el crawl pipeline.
3. **Esperar**: Google recrawlea el sitemap cada 1-7 días. Las URLs no
   descubiertas lo serán pronto si hay enlaces internos desde páginas
   indexadas.

**Consejo**: deja el script corriendo contra las 200 top URLs una vez.
No acelera mágicamente, pero te da un mapa claro de qué URLs Google
conoce y cuáles no (el `results.csv` es la fuente de verdad).

## Cuotas GSC

- **URL Inspection API**: ~600 requests/min
- **Indexing requests**: ~200/día (lo que llegue primero)
- Si excedes, el script para automáticamente

**No lances esto más de 1 vez al día** sin motivo.

## Limitaciones

- Solo funciona con propiedades **Domain** o **URL Prefix** ya verificadas
- Google **no garantiza** que indexe una URL aunque se lo pidas
- El script NO hace submit a Bing Webmaster Tools

## Estructura

```
scripts/gsc-indexer/
├── package.json                # google-auth-library + open
├── login.mjs                   # OAuth login (1 vez)
├── index.mjs                   # script principal
├── fetch-urls-from-sitemap.mjs # genera urls.txt
├── README.md                   # este archivo
├── .gitignore                  # excluye secrets
├── oauth-client.json           # SOLO OAuth (NO commitear)
├── token.json                  # SOLO OAuth (NO commitear)
├── credentials.json            # SOLO service-account (NO commitear)
├── urls.txt                    # generado (NO commitear)
├── results.csv                 # output (NO commitear)
└── node_modules/               # npm install
```