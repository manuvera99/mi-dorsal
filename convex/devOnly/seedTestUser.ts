// =============================================================================
// mi-dorsal — Dev only: seed-test-user
// =============================================================================
// Crea un usuario de prueba "normal" (role="user", SIN bypass de paywall)
// con 3 PRs y 2 carreras en el calendario.
//
// CÓMO EJECUTAR (desde el directorio del proyecto):
//   npx convex run devOnly/seedTestUser:seedTestUser '{}'
//
// ELIMINAR CUANDO YA NO SE NECESITE:
//   - Borra este archivo.
//   - Limpia las filas del usuario con el script devOnly/cleanTestUser.ts
//     (pídemelo si lo necesitas).
//
// SEGURIDAD:
//   - Solo se ejecuta desde la CLI de Convex (internalMutation), no es
//     accesible desde el cliente.
//   - Idempotente: si ejecutas el seed 2 veces, solo añade las filas
//     que falten (no duplica PRs ni myRaces).
// =============================================================================

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const TEST_USER_ID = "user_test_normal_seed_001";

export const seedTestUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // -----------------------------------------------------------------
    // 1. Profile
    // -----------------------------------------------------------------
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", TEST_USER_ID))
      .unique();

    let profileId: string;
    if (existingProfile) {
      profileId = existingProfile._id;
      // Actualizar campos básicos por si el seed se re-ejecuta con cambios
      await ctx.db.patch(existingProfile._id, {
        displayName: "Carlos Test (normal)",
        email: "test+normal@mi-dorsal.es",
        bio: "Cuenta de prueba. Usuario NORMAL (role=user), sin bypass de paywall, sin suscripción premium. Sirve para ver cómo se ven las cosas como un free user real.",
        club: "Club Atletismo Mi-dorsal (test)",
        birthDate: "1990-04-15",
        onboardingWelcomeSeen: true,
        emailResultsEnabled: true,
        emailRemindersEnabled: true,
        emailWeeklyDigestEnabled: true,
      });
    } else {
      profileId = await ctx.db.insert("profiles", {
        clerkUserId: TEST_USER_ID,
        displayName: "Carlos Test (normal)",
        email: "test+normal@mi-dorsal.es",
        bio: "Cuenta de prueba. Usuario NORMAL (role=user), sin bypass de paywall, sin suscripción premium. Sirve para ver cómo se ven las cosas como un free user real.",
        club: "Club Atletismo Mi-dorsal (test)",
        birthDate: "1990-04-15",
        onboardingWelcomeSeen: true,
        emailResultsEnabled: true,
        emailRemindersEnabled: true,
        emailWeeklyDigestEnabled: true,
        // Inicializar contadores de rate limit a 0 explícitamente
        aiCoachUsageCount: 0,
      });
    }

    // -----------------------------------------------------------------
    // 2. PRs (3 distancias canónicas: 5K, 10K, media maratón)
    // -----------------------------------------------------------------
    // Marcas razonables para un popular de nivel medio-bajo. Le dan
    // VDOT ≈ 40 al Daniels calculator, que se traduce en predicciones
    // de ~22:30 en 5K, 47:00 en 10K, 1:44:00 en media maratón.
    const PR_DEFINITIONS = [
      { distanceM: 5000,  distanceLabel: "5K",  timeSeconds: 22 * 60 + 30, achievedAt: "2025-06-14" },
      { distanceM: 10000, distanceLabel: "10K", timeSeconds: 47 * 60 + 15, achievedAt: "2025-09-21" },
      { distanceM: 21097, distanceLabel: "Media maratón", timeSeconds: 1 * 3600 + 44 * 60 + 50, achievedAt: "2025-11-09" },
    ];

    // Borrar PRs previos del seed (por si re-ejecutas con marcas distintas)
    const existingPrs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profileId as any))
      .collect();
    for (const pr of existingPrs) {
      if (PR_DEFINITIONS.some((p) => p.distanceM === pr.distanceM)) {
        await ctx.db.delete(pr._id);
      }
    }
    for (const pr of PR_DEFINITIONS) {
      await ctx.db.insert("personalRecords", {
        userId: profileId as any,
        distanceM: pr.distanceM,
        distanceLabel: pr.distanceLabel,
        timeSeconds: pr.timeSeconds,
        achievedAt: pr.achievedAt,
        source: "manual",
        isCurrent: true,
      });
    }

    // -----------------------------------------------------------------
    // 3. MyRaces (2 carreras en el calendario: 1 pasada con resultado,
    //              1 futura planificada)
    // -----------------------------------------------------------------
    // IDs reales del catálogo (verificados el 8 sep 2026):
    //   - k579hmfr84z0kv1sprb8hq6vvn8dw2tq: E2E Test PDF Fuencarral, 21K, 2026-09-05
    //   - k578e8kczh7gsgejkb0m5z8hdn8dwb6k: XVI Duatlón de Valdebebas, 10K, 2026-02-08
    //
    // Para que el timeline de /calendario muestre 1 pasada y 1 futura
    // "natural" (no histórica), uso fechas sintéticas futuras y dejo
    // el raceId apuntando a la carrera real. La app no valida que la
    // fecha del myRace coincida con la del race.
    const MY_RACE_DEFINITIONS = [
      {
        raceId: "k579hmfr84z0kv1sprb8hq6vvn8dw2tq", // E2E Test PDF Fuencarral 21K
        status: "done" as const,
        registrationDate: "2026-07-01",
        notes: "Buen día, hice PR en media. La segunda mitad con viento en contra.",
        dorsalNumber: "1284",
        actualTimeSeconds: 1 * 3600 + 42 * 60 + 18,
        actualPosition: 247,
        actualPositionCategory: 18,
        resultSource: "manual" as const,
        resultScrapedAt: now,
        predictedTimeSeconds: 1 * 3600 + 44 * 60 + 50,
        predictionConfidence: "high" as const,
      },
      {
        raceId: "k578e8kczh7gsgejkb0m5z8hdn8dwb6k", // XVI Duatlón de Valdebebas 10K
        status: "planned" as const,
        registrationDate: "2026-09-20",
        notes: "Mi primer duatlón. Vamos a por ello.",
        dorsalNumber: "207",
        predictedTimeSeconds: 47 * 60 + 15,
        predictionConfidence: "high" as const,
      },
    ];

    // Borrar myRaces previos del seed
    const existingMyRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_user", (q) => q.eq("userId", profileId as any))
      .collect();
    for (const mr of existingMyRaces) {
      await ctx.db.delete(mr._id);
    }
    for (const mr of MY_RACE_DEFINITIONS) {
      await ctx.db.insert("myRaces", {
        userId: profileId as any,
        raceId: mr.raceId as any,
        status: mr.status,
        registrationDate: mr.registrationDate,
        notes: mr.notes,
        dorsalNumber: mr.dorsalNumber,
        ...(mr.actualTimeSeconds !== undefined && { actualTimeSeconds: mr.actualTimeSeconds }),
        ...(mr.actualPosition !== undefined && { actualPosition: mr.actualPosition }),
        ...(mr.actualPositionCategory !== undefined && { actualPositionCategory: mr.actualPositionCategory }),
        ...(mr.resultSource && { resultSource: mr.resultSource }),
        ...(mr.resultScrapedAt && { resultScrapedAt: mr.resultScrapedAt }),
        ...(mr.predictedTimeSeconds !== undefined && { predictedTimeSeconds: mr.predictedTimeSeconds }),
        ...(mr.predictionConfidence && { predictionConfidence: mr.predictionConfidence }),
      });
    }

    return {
      ok: true,
      profileId,
      clerkUserId: TEST_USER_ID,
      prs: PR_DEFINITIONS.length,
      myRaces: MY_RACE_DEFINITIONS.length,
      message: `Seed OK. Clerk userId: ${TEST_USER_ID}. NO tiene cuenta real en Clerk — solo sirve para queries con getOptionalUser.`,
    };
  },
});
