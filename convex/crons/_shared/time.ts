// =============================================================================
// mi-dorsal — Helper compartido: cálculo de hora local Europe/Madrid
// =============================================================================
// Usado por:
//   - convex/crons/reminderPreRace.ts: para calcular raceTime UTC
//     a partir de race.startDate + race.startTime y decidir ventanas de recordatorio.
//   - convex/emailNotificationsAction.ts: para calcular hoursUntilRace
//     en el momento del envío y pasar al template del email.
//
// Razón de existir aquí en vez de duplicado:
//   - Madrid usa CEST (UTC+2) en verano y CET (UTC+1) en invierno.
//   - El cambio horario ocurre el último domingo de octubre y el último de
//     marzo. Mantener un mapa manual es propenso a bugs.
//   - Intl.DateTimeFormat respeta el cambio automáticamente.
// =============================================================================

/**
 * Convierte una fecha/hora local Europe/Madrid (YYYY-MM-DDTHH:MM:SS) a
 * milisegundos UTC. Respeta el cambio CEST↔CET automáticamente via
 * Intl.DateTimeFormat. Si el string no es parseable, devuelve NaN.
 */
export function madridLocalToUtcMs(localIso: string): number {
  const naiveUtcMs = new Date(localIso + "Z").getTime();
  if (isNaN(naiveUtcMs)) return NaN;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(naiveUtcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const hourRaw = get("hour");
  const madridAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hourRaw === 24 ? 0 : hourRaw,
    get("minute"),
    get("second"),
  );
  // El offset real de Madrid en esa fecha = madridAsUtcMs - naiveUtcMs.
  // Para obtener la UTC ms real de la hora local Madrid X, sumamos ese offset.
  const offsetMs = madridAsUtcMs - naiveUtcMs;
  return naiveUtcMs - offsetMs;
}

/**
 * Calcula los milisegundos UTC de la salida de una carrera a partir de
 * startDate (YYYY-MM-DD) y startTime (HH:MM o HH:MM:SS).
 * Devuelve NaN si falta startDate.
 */
export function raceStartUtcMs(startDate: string, startTime?: string): number {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return NaN;
  const time = startTime ?? "09:00";
  const [hh, mm] = time.split(":");
  const localIso = `${startDate}T${(hh ?? "09").padStart(2, "0")}:${(mm ?? "00").padStart(2, "0")}:00`;
  return madridLocalToUtcMs(localIso);
}
