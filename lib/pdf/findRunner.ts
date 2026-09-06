// =============================================================================
// mi-dorsal — Parser de clasificaciones en PDF
// =============================================================================
// Estrategia (formato estándar de cronómetros españoles):
//   1. pdf-parse extrae el texto, partido en líneas (dorsal+nombre arriba,
//      tiempo abajo).
//   2. Detectamos cada registro: una línea que empieza por un dorsal (1-4
//      dígitos) seguido de espacio o letra MAYÚSCULA.
//   3. Juntamos las líneas del registro (hasta el próximo dorsal).
//   4. Buscamos el primer `H:MM:SS` en el registro → tiempo oficial.
//   5. Extraemos el nombre: desde el dorsal hasta la primera M o F (género).
//
// Test E2E validado contra el PDF real de la XVIII Media Maratón de
// Fuencarral 2012 (timerunners.es/fuencarral/clasificacion_fuencarral.pdf):
//   dorsal 1414 -> JOSE FELIX ORTIZ GARCIA  1:16:03 (4563s)
//   dorsal 934  -> RICARDO ESTRELLA RAMIREZ 1:16:25 (4585s)
//   dorsal 1751 -> ALICIA PEREZ ZAHONERO    2:28:08 (8888s)
//   dorsal 99999 -> null (no existe)
// =============================================================================

/**
 * Parsea un texto extraído de un PDF de clasificaciones y busca el dorsal.
 * Devuelve el primer match o null.
 */
export function findRunnerInPdfText(
  text: string,
  dorsal: string,
): { runnerName?: string; timeSeconds: number } | null {
  const target = String(dorsal).trim();
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l);

  // Detectar líneas que empiezan con un dorsal (1-4 dígitos) seguido de
  // espacio o MAYÚSCULA (pdf-parse mete espacios entre items del PDF).
  const dorsalAtStart = /^(\d{1,4})(\s|[A-ZÁÉÍÓÚÑ])/;
  const recordStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (dorsalAtStart.test(lines[i])) recordStarts.push(i);
  }
  if (recordStarts.length === 0) return null;

  for (let r = 0; r < recordStarts.length; r++) {
    const start = recordStarts[r];
    const end = r + 1 < recordStarts.length ? recordStarts[r + 1] : lines.length;
    const record = lines.slice(start, end).join(" ");

    // ¿Este registro empieza con el dorsal buscado?
    const m = record.match(new RegExp(`^${target}(\\s|[A-ZÁÉÍÓÑ])`));
    if (!m) continue;

    // Buscar el primer tiempo con formato H:MM:SS o HH:MM:SS
    const timeMatch = record.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
    if (!timeMatch) continue;

    const [hh, mm, ss] = timeMatch[1].split(":").map((p) => parseInt(p, 10));
    if (isNaN(hh) || isNaN(mm) || isNaN(ss)) continue;
    const timeSeconds = hh * 3600 + mm * 60 + ss;
    if (timeSeconds <= 0) continue;

    // Extraer el nombre: desde el dorsal hasta la primera M o F (género).
    // Soportamos DOS formatos según el parser:
    //   - pdf-parse:  "1414JOSE FELIXORTIZ GARCIAM / 11974M35" → "JOSE FELIXORTIZ GARCIA"
    //   - pdfjs-dist: "1414   JOSE FELIX   ORTIZ GARCIA   M / 1" → "JOSE FELIX ORTIZ GARCIA"
    // La M o F del sexo puede ir PEGADA al nombre (sin espacio) o con espacios.
    // Para asegurar que NO matcheamos una M dentro del nombre, exigimos
    // que la M/F vaya seguida de algo típico del campo sexo (`/N` o `M35`):
    const nameMatch = record.match(
      new RegExp(
        `^${target}\\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\\s]*?)[MF](?=\\s*/\\s*\\d|/\\s*\\d|\\d)`,
      ),
    );
    const runnerName = nameMatch
      ? nameMatch[1].trim().replace(/\s+/g, " ")
      : undefined;

    return { runnerName, timeSeconds };
  }
  return null;
}
