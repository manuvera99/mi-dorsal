// =============================================================================
// mi-dorsal — Cron: reminder-pre-race
// =============================================================================
// Diario 9am UTC: envía recordatorios 7d y 1d antes de cada carrera.
//
// Ventanas (sesión 26 sep 2026 — fix por bug de carrera nocturna):
//   - reminder_7d: T-7d ± 12h (rango [156h, 180h] antes de la salida)
//   - reminder_1d: T-1d ± 12h (rango [12h, 36h] antes de la salida)
// Las ventanas son disjuntas (7d termina a 180h, 1d empieza a 36h), así que
// no se solapan. La idempotencia vía notificationLog sigue cubriendo el caso
// extremo de reintentos.
//
// Se apoya en notificationLog para idempotencia: si ya se envió el
// recordatorio 7d para esta myRace, no se vuelve a enviar.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Convierte una fecha/hora local Europe/Madrid (YYYY-MM-DDTHH:MM:SS) a
 * milisegundos UTC. Respeta el cambio CEST↔CET automáticamente.
 * Usamos Intl.DateTimeFormat para evitar mantener un mapa manual de offsets.
 */
function madridLocalToUtcMs(localIso: string): number {
  // Parseamos como si fuera UTC, luego medimos cuánto se偏移 el timezone
  // real de Madrid respecto a UTC para esa fecha y ajustamos.
  const naiveUtcMs = new Date(localIso + "Z").getTime();
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
  const madridAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  // El offset real de Madrid en esa fecha = madridAsUtcMs - naiveUtcMs.
  // Para obtener la UTC ms real de la hora local Madrid X, sumamos ese offset.
  const offsetMs = madridAsUtcMs - naiveUtcMs;
  return naiveUtcMs - offsetMs;
}

// ---------------------------------------------------------------------------
// Query: carreras que necesitan recordatorio hoy
// ---------------------------------------------------------------------------

export const getRacesNeedingReminder = internalQuery({
  args: {},
  handler: async (ctx: any) => {
    const now = Date.now();
    const HOUR = 3600 * 1000;
    // Antes: ventana ±6h centrada en T-7d / T-1d. Fallaba para carreras con
    // hora de salida tardía (ej. 15K Nocturna Valencia, 22:30 CEST = 20:30 UTC)
    // porque la diff con el target era ~11h30, fuera de la ventana, y el
    // recordatorio nunca llegaba. Ahora comparamos contra la HORA REAL de
    // salida con ventanas disjuntas (7d termina en 180h, 1d empieza en 36h
    // para que no haya solape entre tipos — la idempotencia de notificationLog
    // ya protegía contra duplicados, pero así es más limpio y más legible).
    // reminder_1d se ensancha hacia abajo (minH=4) para cubrir carreras
    // que se corren el mismo día del cron: ej. 15K Nocturna Valencia sale
    // a las 20:30 UTC y el cron corre a las 9:00 UTC — faltan 11h, fuera
    // de la ventana 1d estándar. Sin este ensanche, carreras nocturnas/
    // vespertinas se quedaban sin recordatorio "1d" aunque quedasen horas.
    const SEVEN_D_WINDOW = { minH: 156, maxH: 180 }; // T-7d ± 12h
    const ONE_D_WINDOW = { minH: 4, maxH: 36 }; // T-1d ensanchado: [4h, 36h]

    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const needs7d: any[] = [];
    const needs1d: any[] = [];

    for (const myRace of all) {
      const race = await ctx.db.get(myRace.raceId);
      if (!race?.startDate) continue;
      // Combinar startDate (YYYY-MM-DD) + startTime (HH:MM, Europe/Madrid implícito)
      // para calcular la hora REAL de salida en UTC. Antes solo usábamos
      // startDate, que se parsea como medianoche UTC — eso significaba que
      // carreras con salida a las 22:30 CEST (= 20:30 UTC) se interpretaban
      // como "ya pasadas" por 20h, y quedaban fuera de TODAS las ventanas
      // (incluida la de recordatorio). Ahora construimos la fecha local en
      // Europe/Madrid y la convertimos a UTC con Intl.DateTimeFormat, que
      // respeta el cambio de horario CEST↔CET automáticamente.
      const timeStr: string = (race as any).startTime ?? "09:00";
      const [hhStr, mmStr] = timeStr.split(":");
      const localIso = `${race.startDate}T${(hhStr ?? "09").padStart(2, "0")}:${(mmStr ?? "00").padStart(2, "0")}:00`;
      const raceTime = madridLocalToUtcMs(localIso);
      if (isNaN(raceTime)) continue;
      const hoursUntilRace = (raceTime - now) / HOUR;

      // 7 días: solo si entra en la ventana 7d Y NO está también dentro de
      // la ventana 1d (la 1d es más urgente, va primero).
      if (
        hoursUntilRace >= SEVEN_D_WINDOW.minH &&
        hoursUntilRace <= SEVEN_D_WINDOW.maxH &&
        (hoursUntilRace < ONE_D_WINDOW.minH || hoursUntilRace > ONE_D_WINDOW.maxH)
      ) {
        const alreadySent = await ctx.db
          .query("notificationLog")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", myRace.userId).eq("type", "reminder_7d"),
          )
          .filter((q) => q.eq(q.field("relatedMyRaceId"), myRace._id))
          .first();
        if (!alreadySent) {
          needs7d.push({ myRace, race });
        }
      }

      // 1 día
      if (
        hoursUntilRace >= ONE_D_WINDOW.minH &&
        hoursUntilRace <= ONE_D_WINDOW.maxH
      ) {
        const alreadySent = await ctx.db
          .query("notificationLog")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", myRace.userId).eq("type", "reminder_1d"),
          )
          .filter((q) => q.eq(q.field("relatedMyRaceId"), myRace._id))
          .first();
        if (!alreadySent) {
          needs1d.push({ myRace, race });
        }
      }
    }

    return { needs7d, needs1d };
  },
});

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------

export const reminderPreRace = internalAction({
  args: {},
  handler: async (ctx: any) => {
    const { needs7d, needs1d } = await ctx.runQuery(
      internal.crons.reminderPreRace.getRacesNeedingReminder,
    );

    console.log(
      `[reminder-pre-race] 7d: ${needs7d.length}, 1d: ${needs1d.length}`,
    );

    let sent7d = 0;
    let sent1d = 0;
    let skippedNoEmail = 0;
    let errorCount = 0;

    // 7 días
    for (const { myRace, race } of needs7d) {
      const profile = await ctx.runQuery(
        internal.crons.reminderPreRace.getProfile,
        { userId: myRace.userId },
      );
      if (!profile?.email) {
        skippedNoEmail++;
        continue;
      }
      if (profile.emailRemindersEnabled === false) continue;

      try {
        await ctx.runAction(internal.emailNotificationsAction.sendReminderEmail, {
          userId: profile._id,
          myRaceId: myRace._id,
          raceName: race.name,
          dorsalNumber: myRace.dorsalNumber,
          predictedTimeSeconds: myRace.predictedTimeSeconds,
          daysUntil: 7,
        });
        sent7d++;
      } catch (err) {
        errorCount++;
        console.error(
          `[reminder-pre-race] Error enviando 7d para ${race.name}:`,
          err,
        );
      }
    }

    // 1 día
    for (const { myRace, race } of needs1d) {
      const profile = await ctx.runQuery(
        internal.crons.reminderPreRace.getProfile,
        { userId: myRace.userId },
      );
      if (!profile?.email) {
        skippedNoEmail++;
        continue;
      }
      if (profile.emailRemindersEnabled === false) continue;

      try {
        await ctx.runAction(internal.emailNotificationsAction.sendReminderEmail, {
          userId: profile._id,
          myRaceId: myRace._id,
          raceName: race.name,
          dorsalNumber: myRace.dorsalNumber,
          predictedTimeSeconds: myRace.predictedTimeSeconds,
          daysUntil: 1,
        });
        sent1d++;
      } catch (err) {
        errorCount++;
        console.error(
          `[reminder-pre-race] Error enviando 1d para ${race.name}:`,
          err,
        );
      }
    }

    console.log(
      `[reminder-pre-race] Resumen: 7d=${sent7d}, 1d=${sent1d}, sin-email=${skippedNoEmail}, errores=${errorCount}`,
    );
  },
});

/**
 * Query interna: devuelve el profile con su email.
 */
export const getProfile = internalQuery({
  args: { userId: v.id("profiles") },
  handler: async (ctx: any, { userId }) => {
    return await ctx.db.get(userId);
  },
});
