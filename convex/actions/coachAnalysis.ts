// =============================================================================
// mi-dorsal — Análisis del entrenador IA
// =============================================================================
// Action pública que un usuario logueado dispara desde /perfil ("Pedir
// análisis de mi entrenador"). Reúne su registro de entrenamiento (stats
// agregadas + tipo de corredor + PRs), llama a un LLM con voz de entrenador
// experimentado, y cachea el resultado en el profile.
//
// No corre en background ni la agenda ningún cron — el usuario la dispara
// directamente, así que ctx.auth.getUserIdentity() SÍ tiene la sesión de
// Clerk de la request (a diferencia de las actions de sync de Strava, que
// corren vía ctx.scheduler sin sesión adjunta).
// =============================================================================

"use node";

import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { generateCoachAnalysis, type CoachAnalysisInput } from "../../lib/ai/coach-analysis";

export const generateMyAnalysis = action({
  args: {},
  handler: async (ctx): Promise<{
    text: string;
    generatedAt: number;
    usage: { count: number; limit: number; resetAt: number | null };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: inicia sesión para pedir tu análisis");
    }

    const profile = await ctx.runQuery(internal.coachAnalysisHelpers.getProfileByClerkId, {
      clerkUserId: identity.subject,
    });
    if (!profile) {
      throw new Error("Perfil no encontrado");
    }

    // -----------------------------------------------------------------
    // Rate limit (sesión 8 sep 2026):
    //   - admin / test: ilimitado
    //   - pro (suscripción premium activa): ilimitado
    //   - free (user sin suscripción): 1/mes
    // La mutation interna `incrementCoachUsage` deduce internamente si
    // hay suscripción premium activa (mira la tabla subscriptions), y
    // se encarga de comprobar el límite, incrementar el contador del
    // mes (reseteando si toca) y devolver el estado. Si el usuario ha
    // agotado su cuota, lanza un error con el mensaje que verá la UI.
    // -----------------------------------------------------------------
    const usage = await ctx.runMutation(internal.coachAnalysisHelpers.incrementCoachUsage, {
      profileId: profile._id,
    });
    // Si el rate limit está agotado, incrementCoachUsage lanza un error
    // con un mensaje user-friendly. En success, `usage` lleva el estado
    // actual del contador — útil para logs internos (no lo devolvemos
    // aquí porque releemos con getMyCoachUsage más abajo para tener
    // la versión "vista cliente" consistente).
    void usage;

    const data = await ctx.runQuery(internal.coachAnalysisHelpers.getAnalysisInputs, {
      profileId: profile._id,
    });

    const input: CoachAnalysisInput = {
      ...data,
      displayName: profile.displayName,
    };

    const text = await generateCoachAnalysis(input);
    const generatedAt = Date.now();

    await ctx.runMutation(internal.coachAnalysisHelpers.saveAnalysis, {
      profileId: profile._id,
      text,
      generatedAt,
    });

    // Releer el estado del rate limit para devolverlo a la UI.
    // (1 query extra, pero le da al componente el count actualizado
    // sin que tenga que hacer otro useQuery manual.)
    //
    // NOTA: getMyCoachUsage es una query pública (no internalQuery)
    // porque la usa también `useQuery` desde el cliente. Aquí la
    // llamamos vía `api.*` (no `internal.*`).
    const finalUsage = await ctx.runQuery(api.coachAnalysisHelpers.getMyCoachUsage, {});

    return { text, generatedAt, usage: finalUsage };
  },
});
