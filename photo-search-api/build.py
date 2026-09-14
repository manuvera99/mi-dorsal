"""Build script de Vercel (tool.vercel.scripts.build en pyproject.toml).

Se ejecuta tras `uv sync` y antes de empaquetar la función. Necesario por un
problema real detectado en el primer despliegue: scikit-image usa
`lazy_loader.attach_stub()` en cascada — no solo en `skimage/__init__.py`,
también en varios submódulos (`skimage.exposure`, etc.) — y ese mecanismo
busca en tiempo de IMPORT un fichero `__init__.pyi` adyacente para resolver
qué exponer perezosamente. El file-tracer de Vercel no sigue esa dependencia
dinámica (no es un `import` estático) y nunca incluye los `.pyi` en el bundle
final: falla en producción con "Cannot load imports from non-existent stub",
aunque el build local con `vercel build` termine sin avisos. `includeFiles`
en vercel.json tampoco sirve para esto: solo cubre archivos del propio repo,
no el virtualenv que crea `uv` durante el build en el servidor.

Solución: para cada `__init__.py` bajo `skimage/` que use `attach_stub`,
leemos su `.pyi` adyacente (que SÍ existe en el filesystem del builder,
solo no viaja en el bundle) con el mismo parser que usa lazy_loader
internamente, y generamos un `__init__.py` con imports directos equivalentes.
Recursivo porque el problema se repite varios niveles dentro del paquete.
"""

from __future__ import annotations

import sysconfig
from pathlib import Path


def _patch_lazy_stub_module(init_path: Path) -> bool:
    """Reescribe un __init__.py que usa attach_stub con imports directos.

    Devuelve True si se parcheó algo.
    """
    content = init_path.read_text(encoding="utf-8")
    if "attach_stub" not in content:
        return False

    stub_path = init_path.with_suffix(".pyi")
    if not stub_path.exists():
        print(f"build.py: {init_path} usa attach_stub pero no hay .pyi adyacente, se deja igual")
        return False

    import lazy_loader  # type: ignore[import-untyped]

    getattr_fn, dir_fn, all_list = lazy_loader.attach_stub(str(init_path.parent.name), str(init_path))
    # attach_stub no expone submodules/submod_attrs directamente, así que
    # reparseamos el .pyi con el mismo visitor interno para reconstruir los
    # imports explícitos.
    import ast

    stub_node = ast.parse(stub_path.read_text(encoding="utf-8"))
    visitor = lazy_loader._StubVisitor()  # type: ignore[attr-defined]
    visitor.visit(stub_node)
    submodules = sorted(visitor._submodules)
    submod_attrs = visitor._submod_attrs  # dict[str submodule, list[str attrs]]

    lines = ["# --- parcheado por build.py: imports directos en vez de attach_stub ---"]
    for sub in submodules:
        lines.append(f"from . import {sub}")
    for sub, attrs in submod_attrs.items():
        if not attrs:
            continue
        joined = ", ".join(attrs)
        lines.append(f"from .{sub} import {joined}")
    patch_block = "\n".join(lines)

    # Sustituimos solo el bloque de attach_stub, dejando el resto del módulo
    # intacto (docstrings, __version__, etc.) — buscamos las dos líneas típicas.
    new_content_lines = []
    skip_next_blank = False
    replaced = False
    src_lines = content.split("\n")
    i = 0
    while i < len(src_lines):
        line = src_lines[i]
        if "attach_stub" in line and not replaced:
            # Sustituye esta línea (y la de "import lazy_loader" previa si
            # está justo antes) por el bloque de imports directos.
            if new_content_lines and "import lazy_loader" in new_content_lines[-1]:
                new_content_lines.pop()
            new_content_lines.append(patch_block)
            replaced = True
        else:
            new_content_lines.append(line)
        i += 1

    if not replaced:
        print(f"build.py: no se encontró línea attach_stub para sustituir en {init_path}")
        return False

    init_path.write_text("\n".join(new_content_lines), encoding="utf-8")
    return True


def main() -> None:
    site_packages = Path(sysconfig.get_path("purelib"))
    skimage_root = site_packages / "skimage"
    if not skimage_root.exists():
        print(f"build.py: {skimage_root} no existe, nada que parchear")
        return

    patched = 0
    for init_path in sorted(skimage_root.rglob("__init__.py")):
        if _patch_lazy_stub_module(init_path):
            patched += 1
            print(f"build.py: parcheado {init_path.relative_to(site_packages)}")

    print(f"build.py: {patched} módulo(s) de skimage parcheados (lazy_loader -> imports directos)")


if __name__ == "__main__":
    main()
