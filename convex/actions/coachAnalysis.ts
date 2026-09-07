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

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { generateCoachAnalysis, type CoachAnalysisInput } from "../../lib/ai/coach-analysis";

export const generateMyAnalysis = action({
  args: {},
  handler: async (ctx): Promise<{ text: string; generatedAt: number }> => {
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

    return { text, generatedAt };
  },
});
