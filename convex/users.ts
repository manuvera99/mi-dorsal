// =============================================================================
// mi-dorsal — Users / Profiles
// =============================================================================

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getOptionalUser, requireUser, requireAdmin } from "./_helpers";

/**
 * Crea o actualiza el profile del usuario autenticado.
 * Se llama desde el frontend tras login (Clerk webhook o useEffect en root).
 */
export const upsertMyProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    club: v.optional(v.string()),
    // YYYY-MM-DD o null/"" para borrar. Validado en el handler para evitar
    // basura en la DB (strings arbitrarios, fechas inválidas, etc.).
    birthDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Normalizamos birthDate: "" o null → undefined (no se setea).
    // Formato YYYY-MM-DD, valido y ≤ hoy. Si no, se ignora silenciosamente
    // (es preferible a un throw en una mutation de upsert del onboarding).
    const birthDate = normalizeBirthDate(args.birthDate);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.displayName !== undefined && { displayName: args.displayName }),
        ...(args.avatarUrl !== undefined && { avatarUrl: args.avatarUrl }),
        ...(args.bio !== undefined && { bio: args.bio }),
        ...(args.club !== undefined && { club: args.club }),
        // birthDate se aplica siempre que el caller lo haya enviado (incluido
        // el caso "" → undefined para borrar). Si no lo envió, no se toca.
        ...(args.birthDate !== undefined && { birthDate }),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("profiles", {
        clerkUserId: identity.subject,
        displayName: args.displayName ?? identity.name ?? identity.email,
        avatarUrl: args.avatarUrl ?? identity.pictureUrl,
        ...(birthDate !== undefined && { birthDate }),
        emailResultsEnabled: true,
        emailRemindersEnabled: true,
        emailWeeklyDigestEnabled: true,
      });
    }
  },
});

/**
 * Obtiene el profile del usuario actual.
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    return await getOptionalUser(ctx);
  },
});

/**
 * Obtiene el profile por clerkUserId (público).
 */
export const getProfileByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
  },
});

/**
 * ⚠️ DEPRECATED — El bootstrap del primer admin está desactivado.
 * Solo los admins existentes pueden promover usuarios (vía setUserRole).
 * Si necesitas reinicializar, crea un nuevo proyecto Convex.
 */
export const bootstrapFirstAdmin = mutation({
  args: {},
  handler: async () => {
    throw new Error("Bootstrap desactivado. Pide a un admin que te promueva.");
  },
});

/**
 * Cambia el rol de un usuario. Solo admins pueden.
 *
 * Roles soportados:
 *  - 'user'  → usuario normal.
 *  - 'admin' → acceso al panel /admin.
 *  - 'test'  → beta-tester. Mismas capacidades que 'user' hoy; cuando
 *              lleguen los tiers de pago, se le dará bypass de premium.
 *              Un admin lo marca desde /admin/users/[id].
 *
 * Guard de auto-degradación: un admin NO puede degradarse a sí mismo
 * (de 'admin' a 'user' o 'test'). Para evitar que un admin se quede
 * sin acceso accidentalmente. Si el último admin quiere salir, lo
 * tiene que promover a 'admin' a otro usuario primero.
 *
 * Tampoco puede degradar a otro admin sin promoverse a sí mismo como
 * 'admin' primero (defensa en profundidad: dos admins mínimo).
 */
export const setUserRole = mutation({
  args: {
    profileId: v.id("profiles"),
    role: v.union(v.literal("user"), v.literal("admin"), v.literal("test")),
  },
  handler: async (ctx, { profileId, role }) => {
    const me = await requireAdmin(ctx);

    const target = await ctx.db.get(profileId);
    if (!target) throw new Error("Profile no encontrado");

    // No permitir que un admin se quite su propio rol de admin.
    if (target._id === me._id && target.role === "admin" && role !== "admin") {
      throw new Error(
        "No puedes degradarte a ti mismo. Pide a otro admin que te quite el rol.",
      );
    }

    // Si el target es admin y lo vamos a degradar, exigir que haya
    // al menos otro admin activo después del cambio.
    if (target.role === "admin" && role !== "admin") {
      const otherAdmins = await ctx.db
        .query("profiles")
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();
      // otherAdmins incluye al propio target. Si solo queda 1, bloqueamos.
      const remainingAdmins = otherAdmins.filter((p) => p._id !== target._id);
      if (remainingAdmins.length === 0) {
        throw new Error(
          "No puedes degradar al último admin. Promueve a otro usuario primero.",
        );
      }
    }

    await ctx.db.patch(profileId, { role });
    return profileId;
  },
});

/**
 * Lista todos los profiles (admin).
 */
export const adminListProfiles = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(
      v.union(v.literal("user"), v.literal("admin"), v.literal("test")),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let q = ctx.db.query("profiles");
    const all = await q.collect();
    let filtered = all;
    if (args.role) {
      filtered = filtered.filter((p) => p.role === args.role);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.displayName ?? "").toLowerCase().includes(s) ||
          p.clerkUserId.toLowerCase().includes(s),
      );
    }
    return filtered.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
  },
});

/**
 * Detalle de un profile (admin): incluye PRs, myRaces, votes, ratings.
 */
export const adminGetProfile = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;
    const [prs, myRaces, votes, ratings] = await Promise.all([
      ctx.db.query("personalRecords").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
      ctx.db.query("myRaces").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
      ctx.db.query("raceVotes").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
      ctx.db.query("raceRatings").withIndex("by_user", (q) => q.eq("userId", profileId)).collect(),
    ]);
    return { profile, prs, myRaces, votes, ratings };
  },
});

/**
 * Stats globales del admin dashboard.
 * OPTIMIZADO: lee de `statsCache` (1 fila ~200 bytes) en vez de hacer
 * .collect() de 7 tablas. La cache la mantiene un cron cada 5 min
 * (ver convex/stats.ts). Reduce Database I/O de ~GB/mes a ~MB/mes.
 *
 * Devuelve zeros si no hay user/admin (en vez de throw).
 */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile || profile.role !== "admin") {
      // Devuelve estructura vacía para no romper la UI del admin
      return {
        computedAt: 0,
        totalRaces: 0, publishedRaces: 0, featuredRaces: 0,
        totalUsers: 0, adminUsers: 0,
        totalVotes: 0, totalRatings: 0,
        totalMyRaces: 0, totalPRs: 0, totalNotifications: 0,
        racesByProvince: {} as Record<string, number>,
      };
    }
    return await ctx.runQuery(api.stats.getCachedStats, {});
  },
});

/**
 * Stats públicas (sin auth) — para mostrar contadores sin exponer PII.
 * Útil para marketing, dashboard inicial, y para que cualquiera verifique
 * cuántos admins hay sin necesidad de estar logueado.
 *
 * OPTIMIZADO: igual que adminGetStats, lee de statsCache.
 */
export const getPublicStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.runQuery(api.stats.getCachedStats, {});
    return {
      totalUsers: stats.totalUsers,
      adminCount: stats.adminUsers,
      totalRaces: stats.totalRaces,
      publishedRaces: stats.publishedRaces,
      totalVotes: stats.totalVotes,
      totalRatings: stats.totalRatings,
      totalMyRaces: stats.totalMyRaces,
    };
  },
});

// =============================================================================
// ONBOARDING (Sprint 1)
// =============================================================================
// Estado del wizard de bienvenida post-primer-login. Es 100% client-side
// driven: el cliente decide cuándo mostrar el WelcomeOverlay leyendo
// `getOnboardingState` y llama a las mutations para actualizar el estado.
//
// La mutation `markWelcomeSeen` también agenda el envío del email de
// bienvenida (vía `ctx.scheduler.runAfter`) si no se ha enviado antes. La
// idempotencia la garantiza el campo `onboardingWelcomeEmailSentAt`: si ya
// está set, la internal action `sendWelcomeEmail` no hace nada.
// =============================================================================

/**
 * Estado del onboarding del usuario actual. Devuelve `null` si el usuario
 * no está logueado o no tiene profile todavía (caso del primer render
 * post-login antes de que Clerk haya hidratado).
 */
export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return null;
    return {
      welcomeSeen: profile.onboardingWelcomeSeen === true,
      hasFirstRace: typeof profile.onboardingFirstRaceSavedAt === "number",
      hasFirstPr: typeof profile.onboardingFirstPrAddedAt === "number",
      hasWelcomeEmail: typeof profile.onboardingWelcomeEmailSentAt === "number",
    };
  },
});

/**
 * Marca el welcome como visto. Si el email de bienvenida no se ha enviado
 * aún (`onboardingWelcomeEmailSentAt` es null), agenda el envío vía
 * `internal.emailDispatch.sendWelcomeEmail`. La action es idempotente
 * (chequea el flag antes de mandar), así que un reintento del cliente
 * nunca produce duplicados.
 */
export const markWelcomeSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    await ctx.db.patch(profile._id, { onboardingWelcomeSeen: true });

    if (profile.onboardingWelcomeEmailSentAt == null) {
      await ctx.scheduler.runAfter(0, internal.emailDispatch.sendWelcomeEmail, {
        userId: profile._id,
      });
    }
  },
});

/**
 * Marca que el usuario guardó su primera carrera. Idempotente: si ya está
 * set, no hace nada. Llamado desde el botón "guardar carrera" cuando
 * `myRaces` pasa de 0 a 1 fila para ese usuario.
 */
export const markFirstRaceSaved = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    if (profile.onboardingFirstRaceSavedAt != null) return;
    await ctx.db.patch(profile._id, {
      onboardingFirstRaceSavedAt: Date.now(),
    });
  },
});

/**
 * Marca que el usuario añadió su primer PR. Idempotente. Llamado desde
 * la mutation de añadir PR cuando `personalRecords` pasa de 0 a 1 fila.
 */
export const markFirstPrAdded = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    if (profile.onboardingFirstPrAddedAt != null) return;
    await ctx.db.patch(profile._id, {
      onboardingFirstPrAddedAt: Date.now(),
    });
  },
});

// =============================================================================
// HELPERS PRIVADOS
// =============================================================================

/**
 * Normaliza el input de birthDate del usuario:
 * - `null` o `""` o `undefined` → `undefined` (se interpreta como "borrar" o "no tocar").
 * - String con formato YYYY-MM-DD y fecha válida ≤ hoy → mismo string.
 * - Cualquier otro caso → `undefined` (input inválido se ignora silenciosamente).
 *
 * El control de "no tocar" lo hace el caller mirando `args.birthDate !== undefined`,
 * así que este helper solo decide QUÉ valor se persiste (no si se persiste).
 */
function normalizeBirthDate(input: string | null | undefined): string | undefined {
  if (input == null) return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  // Validación: YYYY-MM-DD estricto (no aceptamos "1991-5-1" ni "1991/05/01").
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  // Validación: la fecha debe parsear y no estar en el futuro.
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (parsed.getTime() > todayUtc.getTime()) return undefined;
  return trimmed;
}
