# gsc-indexer · pedir indexación en masa a Google

Script para pedir a Google que indexe URLs concretas de mi-dorsal.com
usando la **URL Inspection API** de Google Search Console.

Útil tras un deploy grande (como el SEO sweep del 19 sep 2026) o cuando
añades carreras nuevas y quieres acelerar el descubrimiento.

## Setup (una sola vez)

### 1. Crear service account en GCP

1. https://console.cloud.google.com/iam-admin/serviceaccounts
2. Tu proyecto de GCP (el que uses para GSC)
3. **+ Create Service Account**
4. Nombre: `gsc-indexer-mi-dorsal`
5. Rol: **ninguno** (no necesita; el permiso lo da GSC)
6. **Done** → click en el service account → **Keys** → **Add Key** →
   **Create new** → **JSON** → guardar como `credentials.json` en
   esta carpeta (`scripts/gsc-indexer/`)

### 2. Dar permiso al service account en GSC

1. https://search.google.com/search-console
2. Settings (engranaje) → **Users and permissions**
3. **Add user** → pegar el email del service account (está en el JSON
   que descargaste, campo `client_email`)
4. Permission: **Owner**
5. **Add**

### 3. Instalar dependencias

```powershell
cd scripts\gsc-indexer
npm install
```

Solo necesitas `google-auth-library` (~5 MB), no `googleapis` completo.

## Uso

### Generar `urls.txt` desde el sitemap

```powershell
SITE_URL="https://www.mi-dorsal.com" node fetch-urls-from-sitemap.mjs
# Por defecto MAX=200 (cuota diaria GSC). Para menos:
SITE_URL="https://www.mi-dorsal.com" MAX=20 node fetch-urls-from-sitemap.mjs
```

El script ordena las URLs por prioridad (fichas de carreras primero)
y por `lastmod` DESC (más recientes primero).

### Ejecutar el indexer

```powershell
SITE_URL="https://www.mi-dorsal.com" node index.mjs
```

Output:

- Log en consola con cada URL (OK / SKIP / ERR)
- `results.csv` con timestamp, URL, verdict, coverage_state, indexing_result, error

### Qué hace cada URL

1. **Inspe**c**ta** el estado actual en GSC
2. Si ya está indexada → **SKIP** (no malgasta quota)
3. Si no → pide `requestIndexing`
4. Loguea resultado en `results.csv`

## Cuotas GSC (importante)

- **URL Inspection API**: ~600 requests/min
- **Indexing requests**: ~200/día (lo que llegue primero)
- Si excedes la cuota diaria, el script para automáticamente y avisa

**No lances esto más de 1 vez al día** sin motivo.

## Limitaciones

- La URL Inspection API solo funciona con propiedades **Domain** o
  **URL Prefix** ya verificadas en GSC.
- Google **no garantiza** que indexe una URL aunque se lo pidas. Si la
  considera de baja calidad o duplicada, la ignora.
- El script NO hace submit a Bing Webmaster Tools. Si quieres lo mismo
  para Bing, dame el aviso y lo añado (es 1 endpoint más con la misma
  lógica).