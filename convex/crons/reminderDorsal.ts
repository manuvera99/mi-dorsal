// =============================================================================
// mi-dorsal — Cron: reminder-dorsal (T-5d)
// =============================================================================
// Diario 9am UTC: para cada myRace en ventana T-5d sin dorsal asignado
// todavía, manda un email recordando meter el dorsal en /calendario.
//
// Diferencias con reminderPreRace (que ya existe en producción):
//   - reminderPreRace mira todas las carreras planned (sin importar si
//     tienen dorsal). reminderDorsal mira SOLO las que NO tienen dorsal,
//     porque es un recordatorio específico para evitar perderlo.
//   - Una sola vez por myRace: idempotencia vía notificationLog.type =
//     "dorsal_reminder", con relatedMyRaceId. Si el usuario mete el dorsal
//     después y se vuelve a planificar otra carrera en el mismo slot, se
//     volvería a mandar.
//   - Ventana: raceDate entre [T-6d, T-4d] (3 días centrada en T-5d).
//     ±1d absorbe el slot diario sin mandar dos veces.
//   - Respetar emailRemindersEnabled del profile.
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Query: myRaces en ventana T-5d sin dorsal
// ---------------------------------------------------------------------------

export const getRacesNeedingDorsalReminder = internalQuery({
  args: {},
  handler: async (ctx: any) => {
    const now = Date.now();
    const target = now + 5 * 86400 * 1000; // T-5d
    // ±48h (no ±24h) para absorber:
    //   - slot diario del cron (corre a las 9:00 UTC).
    //   - diferencia horaria de la carrera (popes en España corren tipo
    //     20:00-22:30 hora local; el diff vs 9:00 UTC puede ser ~11h,
    //     así que entre T-4d 0:00 y T-5d 23:59 estamos hablando de un
    //     total spread de ~48h entre ejecuciones consecutivas del cron).
    //   - flexibilidad para días no laborables / drifts.
    // Si el cron se ejecuta en T-5d ±24h (la "ventana natural"), va a
    // encontrar siempre el mismo myRace gracias a la idempotencia vía
    // notificationLog (type="dorsal_reminder").
    const windowMs = 48 * 3600 * 1000;

    const all = await ctx.db
      .query("myRaces")
      .withIndex("by_status", (q) => q.eq("status", "planned"))
      .collect();

    const out: any[] = [];

    for (const myRace of all) {
      // Skip si ya tiene dorsal. El recordatorio solo aporta valor si
      // el campo sigue vacío.
      if (myRace.dorsalNumber) continue;

      const race = await ctx.db.get(myRace.raceId);
      if (!race?.startDate) continue;
      const raceTime = new Date(race.startDate).getTime();
      if (Number.isNaN(raceTime)) continue;

      // Skip si la carrera ya pasó (safety belt).
      if (raceTime < now - windowMs) continue;

      const diff = Math.abs(raceTime - target);
      if (diff > windowMs) continue;

      // Skip idempotente: si ya se mandó el recordatorio para esta
      // myRace concreta, NO reenvía.
      const alreadySent = await ctx.db
        .query("notificationLog")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", myRace.userId).eq("type", "dorsal_reminder"),
        )
        .filter((q) => q.eq(q.field("relatedMyRaceId"), myRace._id))
        .first();
      if (alreadySent) continue;

      out.push({ myRace, race });
    }

    return out;
  },
});

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------

export const reminderDorsal = internalAction({
  args: {},
  handler: async (ctx: any) => {
    const items = await ctx.runQuery(
      internal.crons.reminderDorsal.getRacesNeedingDorsalReminder,
    );

    console.log(`[reminder-dorsal] ${items.length} carreras candidatas`);

    if (items.length === 0) return;

    let sent = 0;
    let skippedNoEmail = 0;
    let errorCount = 0;

    for (const { myRace, race } of items) {
      const profile = await ctx.db.get(myRace.userId);
      if (!profile?.email) {
        skippedNoEmail++;
        continue;
      }
      // Respetar la preferencia del usuario. Si está false, skip silencioso.
      if (profile.emailRemindersEnabled === false) continue;

      try {
        await ctx.runAction(
          internal.emailNotificationsAction.sendDorsalReminderEmail,
          {
            userId: profile._id,
            myRaceId: myRace._id,
          },
        );
        sent++;
      } catch (err) {
        errorCount++;
        console.error(
          `[reminder-dorsal] Error enviando para ${race.name}:`,
          err,
        );
      }
    }

    console.log(
      `[reminder-dorsal] Resumen: enviados=${sent}, sin-email=${skippedNoEmail}, errores=${errorCount}`,
    );
  },
});

// ---------------------------------------------------------------------------
// Query interna: reusada por la action sendDorsalReminderEmail.
// Carga los datos necesarios para construir la URL del deep link al calendario
// (myRace._id, race.name, race.slug, race.startDate).
// ---------------------------------------------------------------------------

export const getMyRaceForDorsalReminder = internalQuery({
  args: { myRaceId: v.id("myRaces") },
  handler: async (ctx, { myRaceId }) => {
    const myRace = await ctx.db.get(myRaceId);
    if (!myRace) return null;
    const profile = await ctx.db.get(myRace.userId);
    if (!profile) return null;
    const race = await ctx.db.get(myRace.raceId);
    if (!race) return null;
    return {
      myRace: { _id: myRace._id, dorsalNumber: myRace.dorsalNumber },
      profile: { _id: profile._id, email: profile.email, displayName: profile.displayName },
      race: {
        _id: race._id,
        name: race.name,
        slug: race.slug,
        startDate: race.startDate,
        startTime: race.startTime,
        distanceKm: race.distanceKm,
        locality: race.locality,
        venue: race.venue,
      },
    };
  },
});