// =============================================================================
// mi-dorsal — Helpers internos para el análisis del entrenador IA
// =============================================================================
// Queries/mutations internal que usa convex/actions/coachAnalysis.ts. Las
// actions no tienen ctx.db directo, así que estas hacen el trabajo de lectura
// y escritura contra la base de datos.
// =============================================================================

import { v } from "convex/values";
import { internalQuery, internalMutation, query } from "./_generated/server";
import { deriveInputs, computeRunnerType, type ActivityInput } from "./runnerType";
import { isRunningSportType } from "./activities/normalize";

export const getProfileByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
  },
});

/**
 * Reúne todos los datos que necesita el prompt del entrenador: stats
 * agregadas (deriveInputs de runnerType.ts), tags de tipo de corredor, PRs
 * actuales, perfil del usuario (edad, peso, FC en reposo) y resumen de las
 * series detectadas en los últimos 90 días.
 *
 * Solo cuenta actividades de running (ver isRunningSportType).
 */
export const getAnalysisInputs = internalQuery({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const allActivitiesRaw = await ctx.db
      .query("activities")
      .withIndex("by_user_started", (q) => q.eq("userId", profileId))
      .collect();
    const activities = allActivitiesRaw.filter((a) => isRunningSportType(a.stravaSportType));

    const inputs: ActivityInput[] = activities.map((a) => ({
      type: a.type,
      startedAt: a.startedAt,
      distanceM: a.distanceM,
      durationSec: a.durationSec,
      elevationGainM: a.elevationGainM,
      avgHeartRate: a.avgHeartRate,
      avgCadence: a.avgCadence,
    }));

    const derived = deriveInputs(inputs);
    const runnerType = computeRunnerType(inputs);

    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();
    const currentPrs = prs
      .filter((p) => p.isCurrent)
      .sort((a, b) => a.distanceM - b.distanceM)
      .map((p) => ({
        distanceLabel: p.distanceLabel,
        timeSeconds: p.timeSeconds,
        achievedAt: p.achievedAt,
      }));

    // ---------------------------------------------------------------------
    // Perfil del usuario: edad, peso, FC en reposo (lo que el prompt del
    // entrenador necesita para personalizar el análisis).
    // ---------------------------------------------------------------------
    const profile = await ctx.db.get(profileId);
    const age = profile?.birthDate
      ? Math.floor(
          (Date.now() - new Date(profile.birthDate).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;
    const weightKg = profile?.stravaAthleteWeightKg ?? null;
    const restingHrBpm = profile?.stravaAthleteRestHr ?? null;
    const maxHrBpm = profile?.stravaAthleteMaxHr ?? null;

    return {
      totalActivities: derived.totalActivities,
      totalDistanceKm: derived.totalDistanceKm,
      weeklyVolumeMedianKm: derived.weeklyVolumeMedianKm,
      consistencyPct: derived.consistencyPct,
      avgCadenceSpm: derived.avgCadenceSpm,
      elevationPerKm: derived.elevationPerKm,
      trailRatio: derived.trailRatio,
      raceRatio: derived.raceRatio,
      longestRunKm: derived.longestRunM / 1000,
      estimated10KTimeSec: derived.estimated10KTimeSec,
      intervalRatio: derived.intervalRatio,
      easyRatio: derived.easyRatio,
      weeksActive: derived.weeksActive,
      isNewbie: derived.isNewbie,
      paceVariability: derived.paceVariability,
      runnerTypeTags: runnerType.tags,
      personalRecords: currentPrs,
      // Perfil
      age,
      weightKg,
      restingHrBpm,
      maxHrBpm,
    };
  },
});

export const saveAnalysis = internalMutation({
  args: {
    profileId: v.id("profiles"),
    text: v.string(),
    generatedAt: v.number(),
  },
  handler: async (ctx, { profileId, text, generatedAt }) => {
    await ctx.db.patch(profileId, {
      coachAnalysisText: text,
      coachAnalysisAt: generatedAt,
    });
  },
});

// ---------------------------------------------------------------------------
// Rate limit del entrenador IA (sesión 8 sep 2026)
// ---------------------------------------------------------------------------
// Límites por tier:
//   - admin o test:               ilimitado (-1 = sin límite)
//   - pro (suscripción premium):  ilimitado (-1)
//   - user con suscripción premium "normal" (futuro): 3/mes
//   - free (user sin suscripción): 1/mes
//
// Se resetea el día 1 de cada mes (vía cron). Si la fila no tiene
// aiCoachUsageResetAt (usuario nuevo), se inicializa al primer check.
// ---------------------------------------------------------------------------

/** Límite del mes en curso para un profile. -1 = ilimitado (admin, test, pro). */
export function coachLimitForProfile(profile: {
  role?: string | null;
  /** Si tiene una fila en subscriptions con tier=premium activa, lo pasamos
   *  como flag. Para evitar un lookup extra aquí, el caller lo resuelve
   *  y nos pasa `hasActiveSubscription`. */
}, hasActiveSubscription: boolean): number {
  if (profile.role === "admin" || profile.role === "test") return -1;
  if (hasActiveSubscription) {
    // Hoy todos los premium tienen el mismo límite (ilimitado). Reservamos
    // el caso "3/mes" para un tier futuro "premium_basic" si lo creamos.
    return -1;
  }
  return 1; // free
}

/** ¿El usuario ya pasó su límite este mes? Si sí, lanza error. */
function assertWithinCoachLimit(
  profile: { role?: string | null; aiCoachUsageCount?: number; aiCoachUsageResetAt?: number },
  hasActiveSubscription: boolean,
  now: number,
) {
  // Ilimitado (admin, test, pro) → no chequea.
  const limit = coachLimitForProfile(profile, hasActiveSubscription);
  if (limit === -1) return;

  // Si el reset ya pasó, el caller habrá reseteado el contador antes
  // de llamar aquí. Como defense in depth, si por lo que sea el contador
  // quedó por encima del límite, dejamos pasar pero NO incrementamos
  // (lo gestiona el caller con el resultado de esta función).
  const count = profile.aiCoachUsageCount ?? 0;
  if (count >= limit) {
    throw new Error(
      `Has alcanzado tu límite de ${limit} análisis de perfil de corredor este mes. Se resetea el día 1 del mes que viene.`,
    );
  }
  // Marcamos el "now" para que el caller sepa en qué mes estamos.
  void now;
}

/** Helper interno: incrementa el contador del mes, reseteando si toca.
 *  Devuelve el nuevo estado { count, limit, resetAt } para que la UI
 *  muestre el contador al usuario. Deduce internamente si el usuario
 *  tiene suscripción premium activa mirando la tabla subscriptions. */
export const incrementCoachUsage = internalMutation({
  args: {
    profileId: v.id("profiles"),
  },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile no encontrado");

    // Comprobamos in situ si tiene suscripción premium activa. Si la fila
    // no existe, el usuario es free.
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", profile.clerkUserId))
      .unique();
    const hasActiveSubscription =
      !!sub &&
      sub.tier === "premium" &&
      (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");

    const now = Date.now();
    const limit = coachLimitForProfile(profile, hasActiveSubscription);

    // Ilimitado: no tocamos contador, pero devolvemos el estado para la UI.
    if (limit === -1) {
      return { count: 0, limit: -1, resetAt: null as number | null };
    }

    // Reset mensual: si la marca de reset no existe o es de un mes anterior,
    // ponemos el contador a 1 (este uso) y actualizamos la marca.
    const currentReset = profile.aiCoachUsageResetAt;
    const currentCount = profile.aiCoachUsageCount ?? 0;
    const isNewMonth = !currentReset || !isSameUtcMonth(currentReset, now);
    const nextCount = isNewMonth ? 1 : currentCount + 1;
    const nextReset = currentReset && isSameUtcMonth(currentReset, now)
      ? currentReset
      : nextMonthStartUtc(now);

    // Defensa en profundidad: si ya pasó el límite, no incrementamos.
    // (El caller ya habrá comprobado, pero por si acaso.)
    if (!isNewMonth && currentCount >= limit) {
      throw new Error(
        `Has alcanzado tu límite de ${limit} análisis de perfil de corredor este mes. Se resetea el día 1 del mes que viene.`,
      );
    }

    await ctx.db.patch(profileId, {
      aiCoachUsageCount: nextCount,
      aiCoachUsageResetAt: nextReset,
    });

    return { count: nextCount, limit, resetAt: nextReset };
  },
});

/** Query que devuelve el estado del rate limit del coach para
 *  el usuario actual. La UI la usa para mostrar "X de Y al mes".
 *  Es pública (no internal) para que useQuery la pueda llamar
 *  desde /perfil. La autorización implícita es: solo devuelve datos
 *  del usuario autenticado (identity.subject). */
export const getMyCoachUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { count: 0, limit: 0, resetAt: null as number | null, role: null as string | null };
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!profile) {
      return { count: 0, limit: 0, resetAt: null as number | null, role: null as string | null };
    }

    // Comprobar si tiene suscripción premium activa (sin delegation, para
    // ahorrar una query). Si la fila no existe, asumimos free.
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    const hasActiveSubscription =
      !!sub &&
      sub.tier === "premium" &&
      (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");

    const limit = coachLimitForProfile(profile, hasActiveSubscription);

    // Si es ilimitado, no necesitamos mirar el contador.
    if (limit === -1) {
      return {
        count: 0,
        limit: -1,
        resetAt: null as number | null,
        role: profile.role ?? null,
      };
    }

    const now = Date.now();
    const currentReset = profile.aiCoachUsageResetAt;
    const currentCount = profile.aiCoachUsageCount ?? 0;
    const isNewMonth = !currentReset || !isSameUtcMonth(currentReset, now);

    return {
      count: isNewMonth ? 0 : currentCount,
      limit,
      resetAt: isNewMonth ? nextMonthStartUtc(now) : currentReset!,
      role: profile.role ?? null,
    };
  },
});

/** Cron mensual: resetea todos los contadores aiCoachUsageCount cuyo
 *  aiCoachUsageResetAt ya haya pasado. Se ejecuta el día 1 de cada mes
 *  a las 00:05 UTC (5 minutos después del cambio de mes). Es seguro
 *  llamarlo más de una vez (es idempotente). */
export const resetAllCoachUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Recorremos los profiles con aiCoachUsageCount > 0. No usamos un
    // .collect() global para no quemar bandwidth (lección del cron de
    // recalcStats). En su lugar, hacemos una query acotada.
    const candidates = await ctx.db
      .query("profiles")
      .filter((q) => q.gt(q.field("aiCoachUsageCount"), 0))
      .take(500); // tope defensivo

    let reset = 0;
    for (const p of candidates) {
      const resetAt = p.aiCoachUsageResetAt;
      if (!resetAt) continue;
      if (resetAt > now) continue; // aún no toca
      await ctx.db.patch(p._id, {
        aiCoachUsageCount: 0,
        aiCoachUsageResetAt: nextMonthStartUtc(now),
      });
      reset += 1;
    }
    return { reset, scanned: candidates.length };
  },
});

// ---------------------------------------------------------------------------
// Helpers de fecha (mes UTC)
// ---------------------------------------------------------------------------

function isSameUtcMonth(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth()
  );
}

function nextMonthStartUtc(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}

// Re-export para que coachAnalysis.ts use la aserción sin redefinirla.
export { assertWithinCoachLimit };
