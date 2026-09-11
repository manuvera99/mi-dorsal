// =============================================================================
// mi-dorsal — Exportación del sticker a PNG (client-side)
// =============================================================================
// Captura el nodo del lienzo (StickerCanvas, canvasRef) con html-to-image
// y devuelve un Blob PNG con fondo transparente. El nodo capturado tiene
// las dimensiones lógicas 1080x1920 SIN el transform: scale() de
// visualización ni el checkerboard (ambos viven en el wrapper exterior,
// fuera de canvasRef) — por eso el PNG sale a resolución completa y sin
// el ayudante visual del editor.
// =============================================================================

import { toBlob } from "html-to-image";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./StickerCanvas";

export async function exportStickerToBlob(canvasNode: HTMLElement): Promise<Blob> {
  const blob = await toBlob(canvasNode, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: undefined, // mantiene transparencia
    pixelRatio: 1,
  });
  if (!blob) {
    throw new Error("No se pudo generar el PNG del sticker");
  }
  return blob;
}

/** Dispara la descarga local de un Blob en el navegador, sin depender de
 *  que la subida a Convex Storage haya terminado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convierte un Blob a un string base64 (sin el prefijo `data:...;base64,`),
 *  para poder pasarlo como `v.string()` a una Convex action (ej.
 *  emailCustomSticker, que lo adjunta a un email vía Resend). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // reader.result es "data:image/png;base64,AAAA..." — nos quedamos
      // solo con la parte tras la coma.
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el blob"));
    reader.readAsDataURL(blob);
  });
}
