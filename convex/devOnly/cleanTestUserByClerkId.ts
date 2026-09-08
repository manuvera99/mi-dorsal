// =============================================================================
// mi-dorsal — Dev only: clean-test-user-by-clerk-id
// =============================================================================
// Borra un usuario de prueba (y todos sus datos asociados) de la BD.
// Pensado para limpiar el seed fake que pueda haber quedado en prod o
// para borrar un test user real cuando ya no lo necesites.
//
// QUÉ BORRA (por orden):
//   1. PRs del user (personalRecords)
//   2. MyRaces del user (myRaces)
//   3. Si el profile tiene un diplomaStorageId, también borra el archivo
//      de Convex File Storage (best-effort: si falla, solo loguea y sigue)
//   4. El profile en sí
//
// QUÉ NO BORRA (por seguridad, para no liarla):
//   - Actividades de Strava (activities): son muchos registros y pueden
//     contener datos útiles de debug. Si quieres borrarlas, hacerlo a
//     mano con `npx convex data activities`.
//   - Otras tablas que referencien al user (votes, ratings, notifications,
//     raceSuggestions, etc.) — no las tocamos para no romper nada.
//   - El user en Clerk: este script no toca Clerk. Si el user se
//     registró en Clerk, bórralo aparte desde el dashboard de Clerk.
//
// CÓMO EJECUTAR:
//   npx convex run devOnly/cleanTestUserByClerkId:cleanTestUserByClerkId \
//     '{"clerkUserId":"user_test_normal_seed_001"}'
//
//   npx convex run --prod devOnly/cleanTestUserByClerkId:cleanTestUserByClerkId \
//     '{"clerkUserId":"user_XXXXX"}'
//
// SEGURIDAD:
//   - internalMutation: solo accesible desde la CLI de Convex.
//   - Modo dry-run con `dryRun:true` para ver qué se va a borrar SIN
//     borrar nada (útil para confirmar antes de ejecutar en prod).
// =============================================================================

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const cleanTestUserByClerkId = internalMutation({
  args: {
    clerkUserId: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { clerkUserId, dryRun }) => {
    const isDry = dryRun ?? true; // default dryRun:true por seguridad

    // 1. Buscar profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (!profile) {
      return {
        ok: true,
        deleted: false,
        message: `No existe ningún profile con clerkUserId "${clerkUserId}". Nada que borrar.`,
      };
    }

    const report: Record<string, unknown> = {
      ok: true,
      dryRun: isDry,
      clerkUserId,
      profileId: profile._id,
      email: profile.email ?? null,
      displayName: profile.displayName ?? null,
    };

    // 2. Contar PRs
    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .collect();
    report.prsFound = prs.length;

    // 3. Contar myRaces
    const myRaces = await ctx.db
      .query("myRaces")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .collect();
    report.myRacesFound = myRaces.length;

    // 4. Diplomas en storage (best-effort)
    const diplomas: string[] = [];
    for (const mr of myRaces) {
      if (mr.diplomaStorageId) diplomas.push(mr.diplomaStorageId);
    }
    report.diplomasFound = diplomas.length;

    if (isDry) {
      report.message = `DRY RUN. Se borrarían: ${prs.length} PRs, ${myRaces.length} myRaces, ${diplomas.length} archivos de diploma, y el profile. Ejecuta de nuevo con dryRun:false para confirmar.`;
      return report;
    }

    // 5. Borrar PRs
    for (const pr of prs) {
      await ctx.db.delete(pr._id);
    }
    report.prsDeleted = prs.length;

    // 6. Borrar myRaces (los diplomas en storage los borramos después)
    for (const mr of myRaces) {
      await ctx.db.delete(mr._id);
    }
    report.myRacesDeleted = myRaces.length;

    // 7. Borrar archivos de diploma (best-effort: si falla, logueamos y seguimos)
    let diplomasDeleted = 0;
    let diplomasFailed = 0;
    for (const storageId of diplomas) {
      try {
        await ctx.storage.delete(storageId as any);
        diplomasDeleted += 1;
      } catch (e: any) {
        diplomasFailed += 1;
        console.warn(
          `[cleanTestUserByClerkId] no se pudo borrar storage ${storageId}: ${e?.message ?? e}`,
        );
      }
    }
    report.diplomasDeleted = diplomasDeleted;
    report.diplomasFailed = diplomasFailed;

    // 8. Borrar profile
    await ctx.db.delete(profile._id);
    report.profileDeleted = true;

    report.message = `Limpieza completa. Borrados: 1 profile + ${prs.length} PRs + ${myRaces.length} myRaces + ${diplomasDeleted} archivos de diploma.`;

    return report;
  },
});
