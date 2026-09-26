/**
 * Helpers de fechas para el calendario / hilo.
 *
 * Comparamos por **día local** (YYYY-MM-DD en la zona horaria del navegador)
 * y NO por timestamp absoluto (ms). Esto resuelve el caso clásico: una
 * carrera a las 19:00 del 26 de septiembre debe seguir apareciendo como
 * "HOY" todo el día, incluso a las 10:00 de la mañana, y solo al día
 * siguiente (27 sep 00:00) pasa al historial.
 *
 * Usamos la zona horaria local del usuario (la del navegador) porque el
 * calendario personal es local a su zona — no UTC.
 */

/** Devuelve la fecha actual truncada a día (medianoche local). */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Devuelve el inicio del día siguiente (medianoche del día siguiente). */
export function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Una fecha se considera "hoy" si cae en el día actual (local).
 *
 * Acepta: string ISO (YYYY-MM-DD o con hora), number (ms), o Date.
 * Devuelve false si el input es null/undefined o no parsea.
 */
export function isToday(input: string | number | Date | null | undefined): boolean {
  if (input == null) return false;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return false;
  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  return d.getTime() >= today.getTime() && d.getTime() < tomorrow.getTime();
}

/**
 * Una fecha se considera "pasada" si es estrictamente ANTERIOR al día
 * de hoy. Una carrera con fecha = hoy NO es pasada — es HOY.
 */
export function isPastDay(
  input: string | number | Date | null | undefined,
): boolean {
  if (input == null) return false;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < startOfToday().getTime();
}

/**
 * Una fecha se considera "futura" si es >= hoy (incluye el día de hoy).
 * Una carrera hoy cuenta como futura para la vista "Próximas" del
 * calendario, con un badge "HOY" para distinguirla visualmente.
 */
export function isTodayOrFuture(
  input: string | number | Date | null | undefined,
): boolean {
  if (input == null) return false;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return false;
  return d.getTime() >= startOfToday().getTime();
}
