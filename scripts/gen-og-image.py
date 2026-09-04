"""
Genera todos los assets PNG de marca a partir de los PNGs fuente del usuario.

Fuentes (en public/brand-assets/) — mapeo verificado leyendo el contenido real:
- og-image-source.png             -> public/og-image.png (1200x630)
- app-icon-cream.png              -> app icon iOS (dorsal NEGRO sobre blanco, esquinas redondeadas)
- app-icon-red.png                -> app icon store (dorsal BLANCO sobre rojo)
- isotipo-mono-black.png          -> isotipo ROJO (single source of truth para el símbolo)
- logo-horizontal-cream.png       -> logo principal horizontal (isotipo + wordmark, fondo crema)
- wordmark-dark.png               -> wordmark sobre fondo oscuro
- logo-horizontal-transparent.jfif -> logo full con tagline (mi-dorsal + tagline + isotipo)

Single source of truth = los PNGs en public/brand-assets/.
Si quieres cambiar la marca, sustituyes los archivos fuente y re-ejecutas este script.
"""
import sys
import traceback
from pathlib import Path
from PIL import Image

ASSETS = Path("C:/desarrollo/mi-dorsal/public/brand-assets")
PUBLIC = Path("C:/desarrollo/mi-dorsal/public")


def resize_to(src: Path, dst: Path, w: int, h: int, keep_aspect: bool = False) -> None:
    """Redimensiona un PNG fuente al tamaño destino. Si keep_aspect=True, hace letterbox."""
    im = Image.open(src).convert("RGBA")
    if keep_aspect:
        iw, ih = im.size
        scale = min(w / iw, h / ih)
        nw, nh = int(iw * scale), int(ih * scale)
        im = im.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(im, ((w - nw) // 2, (h - nh) // 2), im)
        canvas.save(dst)
    else:
        im = im.resize((w, h), Image.LANCZOS)
        im.save(dst)
    print(f"  OK {dst.name} ({w}x{h}, {dst.stat().st_size} bytes)")


def main() -> int:
    print("Generando assets de marca desde public/brand-assets/ ...")

    # 1) OG image 1200x630
    print("\n[1] OG image (1200x630)")
    src = ASSETS / "og-image-source.png"
    if not src.exists():
        print(f"  ERROR: falta {src}")
        return 1
    im = Image.open(src).convert("RGB")
    iw, ih = im.size
    target_ratio = 1200 / 630
    src_ratio = iw / ih
    if src_ratio > target_ratio:
        new_w = int(ih * target_ratio)
        left = (iw - new_w) // 2
        im = im.crop((left, 0, left + new_w, ih))
    else:
        new_h = int(iw / target_ratio)
        top = (ih - new_h) // 2
        im = im.crop((0, top, iw, top + new_h))
    im = im.resize((1200, 630), Image.LANCZOS)
    out = PUBLIC / "og-image.png"
    im.save(out, "PNG", optimize=True)
    print(f"  OK {out.name} (1200x630, {out.stat().st_size} bytes)")

    # 2) App icon iOS (dorsal negro sobre blanco, esquinas redondeadas) — fuente app-icon-cream.png
    print("\n[2] App icon iOS (dorsal negro)")
    src = ASSETS / "app-icon-cream.png"
    if src.exists():
        resize_to(src, PUBLIC / "icon-192.png", 192, 192)
        resize_to(src, PUBLIC / "icon-512.png", 512, 512)
        resize_to(src, PUBLIC / "apple-touch-icon.png", 180, 180)
    else:
        print(f"  WARN: falta {src}")

    # 3) App icon store (dorsal blanco sobre rojo) — para PWA install / app store
    print("\n[3] App icon store (dorsal blanco sobre rojo)")
    src = ASSETS / "app-icon-red.png"
    if src.exists():
        resize_to(src, PUBLIC / "app-icon-red-1024.png", 1024, 1024)
        resize_to(src, PUBLIC / "app-icon-red-512.png", 512, 512)

    # 4) Favicons 16/32/48 — desde el isotipo ROJO (single source of truth del símbolo)
    print("\n[4] Favicons (16/32/48) — desde isotipo rojo")
    src = ASSETS / "isotipo-mono-black.png"  # contiene el isotipo rojo real
    if src.exists():
        resize_to(src, PUBLIC / "favicon-16x16.png", 16, 16)
        resize_to(src, PUBLIC / "favicon-32x32.png", 32, 32)
        resize_to(src, PUBLIC / "favicon-48x48.png", 48, 48)
    else:
        # fallback al app icon cream
        print(f"  WARN: falta {src}, usando app-icon-cream.png")
        src = ASSETS / "app-icon-cream.png"
        if src.exists():
            resize_to(src, PUBLIC / "favicon-16x16.png", 16, 16)
            resize_to(src, PUBLIC / "favicon-32x32.png", 32, 32)
            resize_to(src, PUBLIC / "favicon-48x48.png", 48, 48)

    # 5) Logo principal horizontal (fondo crema)
    print("\n[5] Logo principal (horizontal, fondo crema)")
    src = ASSETS / "logo-horizontal-cream.png"
    if src.exists():
        resize_to(src, PUBLIC / "logo.png", 800, 185)

    # 6) Logo light (wordmark sobre fondo oscuro)
    print("\n[6] Logo light (wordmark sobre fondo oscuro)")
    src = ASSETS / "wordmark-dark.png"
    if src.exists():
        resize_to(src, PUBLIC / "logo-light.png", 800, 150)

    # 7) Logo full con tagline (versión grande, para hero/banner)
    print("\n[7] Logo full con tagline (PNG + WebP optimizado)")
    src = ASSETS / "logo-horizontal-transparent.jfif"
    if src.exists():
        im = Image.open(src).convert("RGBA")
        # PNG alta resolución para uso general
        im_png = im.copy()
        im_png.thumbnail((1200, 1200), Image.LANCZOS)
        im_png.save(PUBLIC / "logo-wordmark.png", "PNG", optimize=True)
        print(f"  OK logo-wordmark.png ({im_png.size[0]}x{im_png.size[1]}, {(PUBLIC / 'logo-wordmark.png').stat().st_size} bytes)")
        # WebP optimizado para web (mucho más ligero)
        im_webp = im.copy()
        im_webp.thumbnail((1200, 1200), Image.LANCZOS)
        im_webp.save(PUBLIC / "logo-wordmark.webp", "WEBP", quality=85, method=6)
        print(f"  OK logo-wordmark.webp ({im_webp.size[0]}x{im_webp.size[1]}, {(PUBLIC / 'logo-wordmark.webp').stat().st_size} bytes)")

    # 8) Isotipo rojo solo (sin container) — para usar en emails, headers
    print("\n[8] Isotipo rojo solo")
    src = ASSETS / "isotipo-mono-black.png"
    if src.exists():
        resize_to(src, PUBLIC / "isotipo-red.png", 512, 512)

    # 9) Isotipo negro puro (1 tinta) — para impresión
    print("\n[9] Isotipo negro puro (impresión 1 tinta)")
    src = ASSETS / "app-icon-cream.png"  # contiene el isotipo en negro
    if src.exists():
        # Crop el centro cuadrado (sin las esquinas redondeadas iOS)
        im = Image.open(src).convert("RGBA")
        iw, ih = im.size
        # Asumimos que el isotipo está centrado con margen, tomamos centro
        # Para iconos iOS las esquinas están transparentes por el redondeo
        # El centro sí es cuadrado y contiene el isotipo
        im_out = im.crop((100, 100, iw - 100, ih - 100))
        im_out = im_out.resize((512, 512), Image.LANCZOS)
        out = PUBLIC / "isotipo-mono.png"
        im_out.save(out)
        print(f"  OK {out.name} (512x512, {out.stat().st_size} bytes)")

    print("\nTodos los assets generados correctamente.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\nERROR: {e}")
        traceback.print_exc()
        sys.exit(1)
