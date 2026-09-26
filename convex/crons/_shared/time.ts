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

/**
 * Formatea una fecha (YYYY-MM-DD) como "sábado, 26 de septiembre" en es-ES,
 * respetando Europe/Madrid. Usado para mostrar la fecha de la carrera en
 * emails de recordatorio / resultado sin que se filtre el formato ISO.
 *
 * Si el string NO es una fecha válida, devuelve el original sin tocar
 * (defensa contra entradas del cron ya formateadas o en formatos raros).
 */
export function formatRaceDateMadrid(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  // Usamos mediodía UTC como hora neutra para que el cambio de día por
  // timezone no nos haga retroceder/avanzar un día en el output.
  const [yyyy, MM, dd] = isoDate.split("-").map(Number);
  const ms = Date.UTC(yyyy, MM - 1, dd, 12, 0, 0);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(ms));
}
