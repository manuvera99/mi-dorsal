# Sesiones paralelas con git worktrees

> Documento on-demand. Léelo antes de abrir una segunda sesión de desarrollo (Claude Code u otra) en este repo mientras ya hay una en marcha.

## Por qué

Trabajar dos features a la vez en el mismo checkout obliga a hacer `git stash`/`checkout` cada vez que cambias de tarea, y arriesga mezclar cambios sin querer. Un **git worktree** da a cada rama su propia carpeta con su propio `git status`, mientras comparten el mismo `.git` (historial, commits, remotos).

## Qué NO aísla un worktree

- **Convex compartido**: este proyecto tiene un único deployment (`precious-goshawk-41`) usado por dev y prod (ver `docs/core/stack.md` / `docs/core/database-schema.md`). Todos los worktrees por defecto apuntan ahí.
- **Puerto de `next dev`**: fijo en 3000 si no se indica otro.
- **`node_modules`**: cada worktree necesita su propio `npm install`.

## Crear un worktree

```bash
scripts/new-worktree.sh <nombre-feature> [puerto]
```

Ejemplo:

```bash
scripts/new-worktree.sh clubs-ranking 3001
```

Esto crea:
- Rama `feature/clubs-ranking`
- Carpeta `.claude/worktrees/clubs-ranking/` (ya está en `.gitignore` vía `.claude/`)
- Copia de `.env.local`
- `npm install` ya ejecutado

Arranca la sesión con:

```bash
cd .claude/worktrees/clubs-ranking
npm run dev -- -p 3001
```

## Regla de convivencia: `convex dev` compartido

**Solo una sesión a la vez debe tener `npx convex dev` corriendo** contra el deployment compartido. Dos `convex dev` simultáneos compiten por el mismo watcher de funciones/schema y pueden pisarse cambios entre ramas — y es el mismo deployment que sirve producción, así que un schema roto ahí afecta a todos.

Si vas a tocar `convex/schema.ts` o cualquier función en una sesión paralela:
1. Avisa (a ti mismo, o en el PR/branch) qué sesión tiene `convex dev` activo.
2. La otra sesión desarrolla el frontend contra el estado actual sin correr `convex dev`, o usa el modo aislado (siguiente sección) si necesita iterar el backend de verdad.

## Modo aislado: Convex Preview Deployment por rama

Para una feature que toca mucho `convex/schema.ts` o corre mutaciones/datos de prueba, usa un deployment aislado:

```bash
export CONVEX_DEPLOY_KEY="<preview-deploy-key>"   # Convex dashboard → Settings → Preview Deploy Keys
scripts/new-worktree.sh sticker-editor 3002 --isolated
```

Esto además:
- Crea un Convex Preview Deployment propio (`--preview-create`), con su propia base de datos y schema — no toca `precious-goshawk-41`.
- Reescribe `NEXT_PUBLIC_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_SITE_URL` en el `.env.local` del worktree.

**Limitación importante**: los Preview Deployments **no soportan `npx convex dev` en modo watch** — solo `npx convex deploy` puntual. Para reflejar un cambio de `convex/`, corre desde el worktree:

```bash
CONVEX_DEPLOY_KEY="<preview-key>" npx convex deploy --preview-name="sticker-editor"
```

cada vez que cambies algo en `convex/`. El frontend (`next dev`) sí recarga en caliente sin volver a desplegar.

Los preview deployments expiran solos a los 5 días (14 en plan de pago) si no se reutilizan — no hace falta borrarlos a mano, aunque puedes hacerlo desde el dashboard.

## Terminar y limpiar

```bash
scripts/rm-worktree.sh <nombre-feature>
```

Comprueba que no haya cambios sin commitear ni commits sin pushear antes de borrar. `--force` para descartar cambios, `--delete-branch` para borrar también la rama local (solo si ya se mergeó).

En Windows, `git worktree remove` puede fallar con `Filename too long` por rutas anidadas dentro de `node_modules` (el script activa `core.longpaths` y hace fallback a borrado manual + `git worktree prune`, pero si aun así falla, bórralo a mano con esas dos órdenes).

## Después del worktree: promocionar por PRE

Antes de mergear una rama de worktree a `master`, pásala primero por el entorno de PRE (`mi-dorsal.vercel.app`, branch `pre`) — ver `docs/core/deploy-checklist.md`. Flujo: `feature/x` → merge a `pre` → verificar en `mi-dorsal.vercel.app` → merge `pre` a `master` → deploy a producción.

## ⚠️ Antes de `vercel deploy` desde un worktree

Un worktree nuevo NO está enlazado al proyecto real de Vercel — `vercel deploy` sin enlazar crea un **proyecto nuevo fantasma** con el nombre de la carpeta del worktree (ej. `deploy-verify-master`), sin ninguna variable de entorno configurada, y el build fallará ahí sin afectar a producción real (que sigue intacta). Antes de cualquier deploy desde un worktree:

```bash
vercel link --yes --project mi-dorsal
```

Esto sobrescribe `.env.local` con un `VERCEL_OIDC_TOKEN` nuevo — no pasa nada, ese archivo no se usa para el build de `vercel deploy` (las env vars reales vienen del dashboard del proyecto).

Si ya creaste un proyecto fantasma por error: `vercel remove <nombre-fantasma> --yes` para borrarlo.

## Checklist antes de abrir PR desde un worktree

Igual que en el checkout principal (`docs/core/deploy-checklist.md`):

```bash
git fetch && git rebase origin/master
npx tsc --noEmit
npm run build
```
