#!/usr/bin/env bash
# Crea un git worktree aislado para trabajar una feature en paralelo con
# otras sesiones/ramas, sin pisar el .next/, node_modules ni (opcionalmente)
# la base de datos de Convex de otra sesión.
#
# Uso:
#   scripts/new-worktree.sh <nombre-feature> [puerto] [--isolated]
#
# Ejemplos:
#   scripts/new-worktree.sh clubs-ranking 3001
#   scripts/new-worktree.sh sticker-editor 3002 --isolated
#
# --isolated crea además un Convex Preview Deployment propio para la rama
# (base de datos y schema separados del deployment compartido dev/prod).
# Requiere CONVEX_DEPLOY_KEY de tipo "preview" (Convex dashboard → Settings
# → Preview Deploy Keys). Sin --isolated, el worktree usa el mismo Convex
# que el resto (precious-goshawk-41) — ver la regla de convivencia en
# docs/core/dev-worktrees.md antes de correr `convex dev` en paralelo.
#
# Requiere ejecutarse desde la raíz del repo (donde vive este script).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NAME="${1:-}"
PORT="${2:-}"
ISOLATED=false

for arg in "$@"; do
  if [ "$arg" = "--isolated" ]; then
    ISOLATED=true
  fi
done

if [ -z "$NAME" ]; then
  echo "Uso: scripts/new-worktree.sh <nombre-feature> [puerto] [--isolated]" >&2
  exit 1
fi

if ! [[ "$NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo "Error: <nombre-feature> solo puede tener minúsculas, números y guiones (ej: clubs-ranking)." >&2
  exit 1
fi

if [ -z "$PORT" ]; then
  PORT=3000
  echo "Aviso: no se indicó puerto, usando $PORT por defecto. Pásalo explícito si vas a correr varios worktrees a la vez (ej: 3001, 3002...)."
fi

BRANCH="feature/$NAME"
WT_DIR=".claude/worktrees/$NAME"

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Error: la rama '$BRANCH' ya existe. Usa un nombre distinto o revisa 'git worktree list'." >&2
  exit 1
fi

if [ -d "$WT_DIR" ]; then
  echo "Error: '$WT_DIR' ya existe." >&2
  exit 1
fi

echo "==> Creando worktree en $WT_DIR (rama $BRANCH)"
git worktree add "$WT_DIR" -b "$BRANCH"

echo "==> Copiando .env.local"
if [ -f .env.local ]; then
  cp .env.local "$WT_DIR/.env.local"
else
  echo "Aviso: no hay .env.local en la raíz, el worktree no tendrá variables de entorno. Cópialas a mano." >&2
fi

echo "==> Instalando dependencias (npm install)"
(cd "$WT_DIR" && npm install)

if [ "$ISOLATED" = true ]; then
  if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
    echo "" >&2
    echo "Error: --isolated requiere CONVEX_DEPLOY_KEY (preview deploy key) en el entorno." >&2
    echo "Consíguela en el dashboard de Convex → Settings → Preview Deploy Keys, y exporta:" >&2
    echo "  export CONVEX_DEPLOY_KEY=\"<preview-key>\"" >&2
    echo "El worktree ya se creó y tiene dependencias instaladas; puedes reintentar solo el paso de Convex:" >&2
    echo "  cd $WT_DIR && CONVEX_DEPLOY_KEY=\"<preview-key>\" npx convex deploy --preview-create=\"$NAME\"" >&2
    exit 1
  fi

  echo "==> Creando Convex Preview Deployment '$NAME' (aislado del deployment compartido)"
  LOG_FILE=$(mktemp)
  (cd "$WT_DIR" && CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" npx convex deploy --preview-create="$NAME" 2>&1 | tee "$LOG_FILE")

  PREVIEW_URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.convex\.cloud' "$LOG_FILE" | head -1 || true)
  rm -f "$LOG_FILE"

  if [ -z "$PREVIEW_URL" ]; then
    echo "" >&2
    echo "Aviso: no se pudo detectar la URL del preview deployment en la salida de 'convex deploy'." >&2
    echo "Revisa la salida arriba y actualiza NEXT_PUBLIC_CONVEX_URL / NEXT_PUBLIC_CONVEX_SITE_URL en $WT_DIR/.env.local a mano." >&2
  else
    SITE_URL="${PREVIEW_URL%.convex.cloud}.convex.site"
    echo "==> Deployment aislado listo: $PREVIEW_URL"
    echo "==> Apuntando $WT_DIR/.env.local al preview deployment"
    sed -i.bak \
      -e "s#^NEXT_PUBLIC_CONVEX_URL=.*#NEXT_PUBLIC_CONVEX_URL=\"$PREVIEW_URL\"#" \
      -e "s#^NEXT_PUBLIC_CONVEX_SITE_URL=.*#NEXT_PUBLIC_CONVEX_SITE_URL=\"$SITE_URL\"#" \
      "$WT_DIR/.env.local"
    rm -f "$WT_DIR/.env.local.bak"
    echo ""
    echo "IMPORTANTE: los Preview Deployments de Convex NO soportan 'npx convex dev' en modo watch."
    echo "Para reflejar cambios de schema/funciones en este preview, corre desde $WT_DIR:"
    echo "  CONVEX_DEPLOY_KEY=\"<preview-key>\" npx convex deploy --preview-name=\"$NAME\""
    echo "cada vez que toques convex/. El frontend (next dev) sí recarga en caliente contra este deployment."
  fi
fi

echo ""
echo "Worktree listo: $WT_DIR"
echo "Rama: $BRANCH"
echo "Siguiente paso:"
echo "  cd $WT_DIR"
echo "  npm run dev -- -p $PORT"
if [ "$ISOLATED" != true ]; then
  echo ""
  echo "Este worktree usa el Convex COMPARTIDO (dev/prod). Antes de correr 'npx convex dev' aquí,"
  echo "lee docs/core/dev-worktrees.md — solo una sesión a la vez debe tener 'convex dev' corriendo"
  echo "contra el deployment compartido para evitar pisar el schema de otra rama."
fi
