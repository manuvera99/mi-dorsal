#!/usr/bin/env bash
# Elimina un worktree creado con scripts/new-worktree.sh: comprueba que no
# haya cambios sin commitear/pushear, borra el directorio del worktree y,
# opcionalmente, la rama local. No toca el Convex Preview Deployment (esos
# expiran solos a los 5-14 días; bórralo a mano en el dashboard si quieres
# liberarlo antes).
#
# Uso:
#   scripts/rm-worktree.sh <nombre-feature> [--force] [--delete-branch]
#
# --force         borra aunque haya cambios sin commitear (los descarta).
# --delete-branch además borra la rama local feature/<nombre-feature>
#                 (solo tiene sentido si ya se mergeó/pusheó).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NAME="${1:-}"
FORCE=false
DELETE_BRANCH=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --delete-branch) DELETE_BRANCH=true ;;
  esac
done

if [ -z "$NAME" ]; then
  echo "Uso: scripts/rm-worktree.sh <nombre-feature> [--force] [--delete-branch]" >&2
  exit 1
fi

BRANCH="feature/$NAME"
WT_DIR=".claude/worktrees/$NAME"

if [ ! -d "$WT_DIR" ]; then
  echo "Error: '$WT_DIR' no existe. ¿Nombre correcto? Revisa 'git worktree list'." >&2
  exit 1
fi

if [ "$FORCE" != true ]; then
  if [ -n "$(git -C "$WT_DIR" status --porcelain 2>/dev/null)" ]; then
    echo "Error: '$WT_DIR' tiene cambios sin commitear. Commitea/stashea o vuelve a llamar con --force para descartarlos." >&2
    git -C "$WT_DIR" status --short
    exit 1
  fi

  AHEAD=$(git -C "$WT_DIR" rev-list --count "origin/master..$BRANCH" 2>/dev/null || echo "0")
  if [ "$AHEAD" != "0" ]; then
    echo "Aviso: la rama '$BRANCH' tiene $AHEAD commit(s) no fusionados en origin/master." >&2
    echo "Si ya abriste PR o no quieres perder el trabajo, no continúes. Reintenta con --force si estás seguro." >&2
    exit 1
  fi
fi

echo "==> Quitando worktree $WT_DIR"
git config core.longpaths true
if ! git worktree remove "$WT_DIR" ${FORCE:+--force}; then
  echo "Aviso: 'git worktree remove' falló (típico en Windows por rutas largas en node_modules)." >&2
  echo "Borrando el directorio a mano y limpiando metadatos..." >&2
  rm -rf "$WT_DIR"
  git worktree prune
fi

if [ "$DELETE_BRANCH" = true ]; then
  echo "==> Borrando rama local $BRANCH"
  git branch -D "$BRANCH"
fi

echo ""
echo "Worktree eliminado."
echo "Si creaste un Convex Preview Deployment aislado ('$NAME'), bórralo desde el"
echo "dashboard de Convex (Deployments → $NAME → Delete) o espera a que expire solo."
