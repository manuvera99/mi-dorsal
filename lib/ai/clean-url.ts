// =============================================================================
// lib/ai/clean-url.ts
// =============================================================================
// Helper para limpiar URLs antes de pasarlas a fetch.
//
// Node.js fetch (y la API web) rechaza URLs con caracteres > 255, incluyendo
// el BOM UTF-8 (U+FEFF, valor 65279) que a veces se pega al copiar URLs de
// ciertas webs. La URL sigue pareciendo correcta visualmente, pero el fetch
// falla con "Cannot convert argument to a ByteString".
//
// Esta función quita:
//   - BOM UTF-8 (U+FEFF)
//   - Zero-width chars (U+200B, U+200C, U+200D, U+2060)
//   - Non-breaking space (U+00A0)
//   - Replacement char (U+FFFD)
//   - Cualquier carácter no-ASCII imprimible (solo deja 0x20-0x7E)
//
// Las URLs válidas son ASCII, así que esto es seguro. Si el usuario pegó una
// URL con caracteres UTF-8 sin percent-encoding, los quitamos (probablemente
// daría error de todos modos al hacer fetch).
// =============================================================================

export function cleanUrl(input: string): string {
  if (!input) return "";
  return input
    // 1. Quitar caracteres invisibles específicos
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060\u00A0\uFFFD]/g, "")
    // 2. Quitar todo lo que no sea ASCII imprimible (0x20-0x7E)
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** Para diagnóstico: devuelve los caracteres "raros" que se quitaron. */
export function diagnoseUrl(input: string): { cleaned: string; removed: Array<{ char: string; code: number; position: number }> } {
  const removed: Array<{ char: string; code: number; position: number }> = [];
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const code = c.charCodeAt(0);
    if (code < 0x20 || code > 0x7E) {
      removed.push({ char: c, code, position: i });
    }
  }
  return { cleaned: cleanUrl(input), removed };
}
