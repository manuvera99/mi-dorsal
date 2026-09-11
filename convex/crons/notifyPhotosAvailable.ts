// =============================================================================
// mi-dorsal — Notificación: fotos de carrera disponibles
// =============================================================================
// NO es un cron periódico (a diferencia de los demás archivos en este
// directorio) — se dispara una sola vez, agendado desde
// convex/races.ts adminUpdate cuando el admin pega photosUrl por primera
// vez en una carrera. Vive en convex/crons/ porque es donde ya está el
// resto de la lógica de notificación disparada por evento de carrera
// (mismo criterio que checkResults.ts).
//
// Itera todas las myRaces de la carrera y envía un email a cada corredor
// inscrito, vía emailDispatch.dispatchAndLog (con adjuntos NO — a
// diferencia de result_found, este email es solo texto+enlace).
// =============================================================================

import { internalAction, internalQuery } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { photosAvailableEmail } from "../emails/templates/photosAvailable";

// ---------------------------------------------------------------------------
// Query: myRaces de una carrera + profile + email, listas para notificar
// ---------------------------------------------------------------------------

type NotifyItem = {
  myRaceId: Id<"myRaces">;
  userId: Id<"profiles">;
  email: string;
  displayName: string | undefined;
};

export const getRunnersForRace = internalQuery({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }): Promise<NotifyItem[]> => {
    const myRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    const items: NotifyItem[] = [];
    for (const myRace of myRaces) {
      const profile = await ctx.db.get(myRace.userId);
      if (!profile?.email) continue; // sin email no podemos avisar
      items.push({
        myRaceId: myRace._id,
        userId: profile._id,
        email: profile.email,
        displayName: profile.displayName,
      });
    }
    return items;
  },
});

// ---------------------------------------------------------------------------
// Action: envía el aviso a todos los inscritos de la carrera
// ---------------------------------------------------------------------------

export const notifyPhotosAvailable = internalAction({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    const race = await ctx.runQuery(api.races.get, { id: raceId });
    if (!race || !race.photosUrl) {
      console.warn(`[photos-available] race ${raceId} sin photosUrl, abortando`);
      return;
    }

    const runners = await ctx.runQuery(
      internal.crons.notifyPhotosAvailable.getRunnersForRace,
      { raceId },
    );

    const raceDateFormatted = race.startDate
      ? new Date(race.startDate).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com").replace(/\/$/, "");

    let sent = 0;
    let skipped = 0;

    for (const runner of runners) {
      const alreadySent = await ctx.runQuery(internal.emailDispatch.hasLog, {
        userId: runner.userId,
        myRaceId: runner.myRaceId,
        type: "photos_available",
      });
      if (alreadySent) {
        skipped++;
        continue;
      }

      const { subject, html, text } = photosAvailableEmail({
        userName: runner.displayName ?? "corredor",
        raceName: race.name,
        raceDate: raceDateFormatted,
        photosUrl: race.photosUrl,
        appUrl,
      });

      await ctx.runAction(internal.emailDispatch.dispatchAndLog, {
        to: runner.email,
        subject,
        html,
        text,
        userId: runner.userId,
        myRaceId: runner.myRaceId,
        type: "photos_available",
      });
      sent++;
    }

    console.log(
      `[photos-available] raceId=${raceId}: ${sent} emails enviados, ${skipped} ya notificados`,
    );
  },
});
