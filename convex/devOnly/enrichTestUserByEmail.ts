// =============================================================================
// mi-dorsal — Dev only: enrich-test-user-by-email
// =============================================================================
// Enriquece un usuario de Clerk existente con 3 PRs + 2 myRaces para
// poder probar la UI como un free user "completo" sin tener que subir
// Strava ni nada.
//
// FLUJO COMPLETO (5 min):
//   1. Ir a https://mi-dorsal.com/sign-up y registrarse con el email
//      del test user (ej. admin@mi-dorsal.com). Clerk crea el user y
//      manda el magic link.
//   2. Abrir el email, hacer click en el magic link, completar el
//      onboarding. Esto crea automáticamente la fila en profiles con
//      el email.
//   3. Ejecutar desde la raíz del proyecto:
//
//        npx convex run devOnly/enrichTestUserByEmail:enrichTestUserByEmail \
//          '{"email":"admin@mi-dorsal.com"}'
//
//      Si quieres ejecutarlo contra producción, añade --prod:
//
//        npx convex run --prod devOnly/enrichTestUserByEmail:enrichTestUserByEmail \
//          '{"email":"admin@mi-dorsal.com"}'
//
// QUÉ HACE:
//   - Busca el profile por email.
//   - Si no existe, devuelve un error claro con el flujo a seguir.
//   - Borra los PRs/myRaces previos del seed (por si re-ejecutas).
//   - Inserta 3 PRs (5K 22:30, 10K 47:15, media 1:44:50).
//   - Inserta 2 myRaces: 1 done con resultado + 1 planned.
//   - NO modifica role (deja el rol que Clerk/Convex le haya asignado,
//     normalmente "user" o nada, equivalente a free sin bypass).
//
// SEGURIDAD:
//   - Solo accesible desde la CLI de Convex (internalMutation).
//   - No expone datos sensibles (el email es el del propio user que
//     acaba de registrarse, no un leak).
// =============================================================================

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const PR_DEFINITIONS = [
  { distanceM: 5000,  distanceLabel: "5K",  timeSeconds: 22 * 60 + 30, achievedAt: "2025-06-14" },
  { distanceM: 10000, distanceLabel: "10K", timeSeconds: 47 * 60 + 15, achievedAt: "2025-09-21" },
  { distanceM: 21097, distanceLabel: "Media maratón", timeSeconds: 1 * 3600 + 44 * 60 + 50, achievedAt: "2025-11-09" },
];

// IDs reales del catálogo (verificados el 8 sep 2026):
//   - k579hmfr84z0kv1sprb8hq6vvn8dw2tq: E2E Test PDF Fuencarral, 21K, 2026-09-05
//   - k578e8kczh7gsgejkb0m5z8hdn8dwb6k: XVI Duatlón de Valdebebas, 10K, 2026-02-08
const MY_RACE_DEFINITIONS = [
  {
    raceId: "k579hmfr84z0kv1sprb8hq6vvn8dw2tq",
    status: "done" as const,
    registrationDate: "2026-07-01",
    notes: "Buen día, hice PR en media. La segunda mitad con viento en contra.",
    dorsalNumber: "1284",
    actualTimeSeconds: 1 * 3600 + 42 * 60 + 18,
    actualPosition: 247,
    actualPositionCategory: 18,
    resultSource: "manual" as const,
    predictedTimeSeconds: 1 * 3600 + 44 * 60 + 50,
    predictionConfidence: "high" as const,
  },
  {
    raceId: "k578e8kczh7gsgejkb0m5z8hdn8dwb6k",
    status: "planned" as const,
    registrationDate: "2026-09-20",
    notes: "Mi primer duatlón. Vamos a por ello.",
    dorsalNumber: "207",
    predictedTimeSeconds: 47 * 60 + 15,
    predictionConfidence: "high" as const,
  },
];

export const enrichTestUserByEmail = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    const now = Date.now();
    const emailLower = email.trim().toLowerCase();

    // 1. Buscar profile por email
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("email"), emailLower))
      .first();

    if (!profile) {
      throw new Error(
        `No existe ningún profile con email "${emailLower}". ` +
        `El usuario tiene que haberse registrado primero en Clerk y haber hecho login al menos una vez ` +
        `para que se cree la fila en profiles (la mutation upsertMyProfile se ejecuta al onboarding). ` +
        `Si el signup ya está hecho pero el profile no aparece, puede que el email en Clerk sea distinto. ` +
        `Compruébalo con: npx convex data profiles --format json | jq '.[] | select(.clerkUserId) | {clerkUserId, email}'`,
      );
    }

    // 2. Bio + displayName actualizados (solo si están vacíos, no machacamos
    //    lo que el usuario haya editado)
    const patch: Record<string, unknown> = {};
    if (!profile.bio) {
      patch.bio = "Cuenta de prueba. Usuario NORMAL (role=user), sin bypass de paywall. Útil para probar la UI como un free user real.";
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(profile._id, patch);
    }

    // 3. Limpiar PRs previos del seed (los 3 que vamos a re-insertar)
    const existingPrs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .collect();
    let deletedPrs = 0;
    for (const pr of existingPrs) {
      if (PR_DEFINITIONS.some((p) => p.distanceM === pr.distanceM)) {
        await ctx.db.delete(pr._id);
        deletedPrs += 1;
      }
    }
    for (const pr of PR_DEFINITIONS) {
      await ctx.db.insert("personalRecords", {
        userId: profile._id,
        distanceM: pr.distanceM,
        distanceLabel: pr.distanceLabel,
        timeSeconds: pr.timeSeconds,
        achievedAt: pr.achievedAt,
        source: "manual",
        isCurrent: true,
      });
    }

    // 4. Limpiar myRaces previos del seed e insertar los nuevos
    const existingMyRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .collect();
    let deletedMyRaces = 0;
    for (const mr of existingMyRaces) {
      // Solo borramos los que apunten a las mismas raceId que vamos a re-insertar.
      // NO tocamos myRaces que el usuario haya creado a mano apuntando a otras carreras.
      if (MY_RACE_DEFINITIONS.some((m) => m.raceId === mr.raceId)) {
        await ctx.db.delete(mr._id);
        deletedMyRaces += 1;
      }
    }
    for (const mr of MY_RACE_DEFINITIONS) {
      await ctx.db.insert("myRaces", {
        userId: profile._id,
        raceId: mr.raceId as any,
        status: mr.status,
        registrationDate: mr.registrationDate,
        notes: mr.notes,
        dorsalNumber: mr.dorsalNumber,
        ...(mr.actualTimeSeconds !== undefined && { actualTimeSeconds: mr.actualTimeSeconds }),
        ...(mr.actualPosition !== undefined && { actualPosition: mr.actualPosition }),
        ...(mr.actualPositionCategory !== undefined && { actualPositionCategory: mr.actualPositionCategory }),
        ...(mr.resultSource && { resultSource: mr.resultSource }),
        // Solo añadimos resultScrapedAt si el myRace tiene resultSource (es decir,
        // si es "done"). Para "planned" no aplica.
        ...(mr.status === "done" && { resultScrapedAt: now }),
        ...(mr.predictedTimeSeconds !== undefined && { predictedTimeSeconds: mr.predictedTimeSeconds }),
        ...(mr.predictionConfidence && { predictionConfidence: mr.predictionConfidence }),
      });
    }

    return {
      ok: true,
      clerkUserId: profile.clerkUserId,
      email: profile.email,
      role: profile.role ?? "(none, equivalent to user)",
      profileId: profile._id,
      deletedPrs,
      insertedPrs: PR_DEFINITIONS.length,
      deletedMyRaces,
      insertedMyRaces: MY_RACE_DEFINITIONS.length,
      message: `Enrichment OK. Login con ${profile.email} (o el email con el que Clerk lo creó) para ver la UI.`,
    };
  },
});
