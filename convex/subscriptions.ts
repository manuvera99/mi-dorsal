// =============================================================================
// mi-dorsal — Subscriptions
// =============================================================================
// Mirror local del estado de subscripción que Clerk Billing (powered by
// Stripe) mantiene como source of truth. La tabla `subscriptions` en
// Convex se sincroniza desde /api/webhooks/clerk-billing.
//
// Convenciones del módulo:
//   - Queries (`getMySubscription`, `getMyPremiumStatus`, `hasPremiumAccess`):
//     accesibles desde el cliente Convex. Devuelven null/false si Clerk
//     Billing está desactivado o el usuario nunca pagó.
//   - Mutations (`upsertFromClerkEvent`, `cancelFromClerkEvent`):
//     `internalMutation`. Solo se llaman desde el webhook handler tras
//     verificar la firma Svix. NUNCA exponer al cliente.
//
// Por qué este módulo existe si Clerk ya gestiona el estado:
//   1) Queries reactivas: el cliente puede usar `useQuery(api.subscriptions.getMySubscription)`
//      y Convex lo re-renderiza automáticamente cuando el webhook actualiza
//      la fila. No necesitamos un fetch extra a Clerk en cada navegación.
//   2) Feature gating en backend: cuando una mutation Convex necesite
//      decidir si un usuario tiene feature premium, llama a
//      `hasPremiumAccess(ctx)` y no toca a Clerk.
//   3) Métricas / admin: queries agregadas (MRR, churn, breakdown por plan)
//      sin scrapear el dashboard de Clerk.
// =============================================================================

import { v } from "convex/values";
import {
  internalMutation,
  action,
  query,
  QueryCtx,
  MutationCtx,
  ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getOptionalUser } from "./_helpers";

/** Payload común a todos los eventos de subscripción. Clerk envía la
 *  subscripción completa dentro de `data` en cada evento. Esta es la
 *  forma del objeto sub según la doc de Clerk Billing.
 *
 *  NOTA: está declarado arriba de todo (antes de las funciones) porque
 *  se referencia en los `args` de actions y mutations. Si se declarara
 *  más abajo, TS lo detectaría como "used before declaration" en el
 *  typecheck de Next.js. */
const clerkSubscriptionPayload = v.object({
  id: v.string(),                              // clerk subscription id
  user_id: v.optional(v.string()),             // puede no venir si fue pago anónimo
  customer_id: v.optional(v.string()),
  customer_email: v.optional(v.string()),
  status: v.string(),                          // active | trialing | past_due | canceled | ...
  plan_id: v.optional(v.string()),             // "free_user", "premium_monthly", ...
  plan_name: v.optional(v.string()),
  // El tier NO viene de Clerk — lo calculamos nosotros a partir del plan_id
  // (ver deriveTierFromPlanId abajo) o lo pasamos explícito.
  current_period_start: v.optional(v.number()),
  current_period_end: v.optional(v.number()),
  cancel_at_period_end: v.optional(v.boolean()),
  canceled_at: v.optional(v.number()),
  amount_cents: v.optional(v.number()),
  currency: v.optional(v.string()),
});

// ---------------------------------------------------------------------------
// Types / Constants
// ---------------------------------------------------------------------------

/** Plan tier = nivel lógico, lo que entiende el feature gating.
 *  "free"   → plan por defecto (no pago)
 *  "premium" → plan de pago (mensual/anual, ambos cuentan como premium) */
export type SubscriptionTier = "free" | "premium";

/** Estados que dan ACCESO premium (no cancelado, no impago permanente).
 *  "active"     → al día con los cobros
 *  "trialing"   → en trial gratuito (también da acceso)
 *  "past_due"   → cobro falló, reintentando — MANTENEMOS acceso durante el
 *                 periodo de gracia para no castigar al usuario por un fallo
 *                 transitorio (tarjeta caducada a final de mes, etc.)
 *  "canceled"   → el usuario canceló, pero el period_end aún no ha vencido —
 *                 seguimos dando acceso hasta entonces (cancelAtPeriodEnd=true
 *                 o currentPeriodEnd en el futuro).
 * El resto de estados ("incomplete", "incomplete_expired", "unpaid",
 * "paused") NO dan acceso. */
const ACCESS_GRANTING_STATES = new Set([
  "active",
  "trialing",
  "past_due",
]);

// ---------------------------------------------------------------------------
// Helpers (reutilizables desde otros módulos Convex)
// ---------------------------------------------------------------------------

/** ¿Este usuario tiene acceso premium AHORA MISMO?
 *  Usar desde mutations/queries que necesiten feature gating.
 *
 *  - Devuelve true si la suscripción está en un estado que da acceso Y
 *    el tier es "premium" Y (si está cancelada) el currentPeriodEnd aún
 *    no ha pasado.
 *  - Devuelve true también si el profile tiene role=admin o role=test
 *    (bypass total del paywall, sesión 8 sep 2026).
 *  - Devuelve false en cualquier otro caso (sin fila, free, cancelada
 *    con periodo vencido, error transitorio, etc.).
 *
 *  Idempotente y sin side-effects. El coste es 1 query con índice
 *  by_clerk_user_id (sub-ms) o 1 query a profiles si hay bypass por rol. */
export async function hasPremiumAccess(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<boolean> {
  // Bypass total para admin y test: no necesitan suscripción, acceden
  // a todo como si fueran premium activo. Se mira en profiles (no en
  // subscriptions) porque el bypass es por ROL, no por estado de pago.
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
  if (profile && (profile.role === "admin" || profile.role === "test")) {
    return true;
  }

  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();

  if (!sub) return false;
  if (sub.tier !== "premium") return false;
  if (!ACCESS_GRANTING_STATES.has(sub.status)) return false;

  // Si está cancelada, verificar que el periodo aún no ha vencido
  if (sub.status === "canceled") {
    if (!sub.currentPeriodEnd) return false;
    if (sub.currentPeriodEnd < Date.now()) return false;
  }

  return true;
}

/** Variante que toma el identity.subject directamente. Útil cuando ya
 *  tienes la identity a mano en una mutation. */
export async function currentUserHasPremium(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  return hasPremiumAccess(ctx, identity.subject);
}

// ---------------------------------------------------------------------------
// Queries (cliente)
// ---------------------------------------------------------------------------

/** Devuelve la suscripción completa del usuario autenticado, o null si
 *  nunca ha pagado o Clerk Billing no está activo todavía. */
export const getMySubscription = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return null;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", profile.clerkUserId))
      .unique();
  },
});

/** Versión light para el feature gating en componentes. Devuelve solo lo
 *  que la UI necesita: { hasAccess, tier, status, currentPeriodEnd, role, bypassed }.
 *  Optimizada para evitar re-renders innecesarios: si nada cambió, no
 *  devuelve un objeto nuevo.
 *
 *  Bypass (sesión 8 sep 2026): admin y test siempre tienen hasAccess=true
 *  aunque no tengan fila en subscriptions. El flag `bypassed:true` permite
 *  a la UI mostrar un mensaje tipo "Acceso total (beta tester)" en vez
 *  de "Premium". */
export const getMyPremiumStatus = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) {
      return {
        hasAccess: false,
        tier: "free" as const,
        status: null,
        currentPeriodEnd: null,
        role: null,
        bypassed: false,
      };
    }

    // Bypass total: admin o test tienen acceso premium sin necesidad de
    // fila en subscriptions. Marcamos `bypassed: true` para que la UI
    // pueda mostrar un mensaje neutro.
    if (profile.role === "admin" || profile.role === "test") {
      return {
        hasAccess: true,
        tier: "premium" as const,
        status: "bypassed",
        currentPeriodEnd: null,
        role: profile.role,
        bypassed: true,
      };
    }

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", profile.clerkUserId))
      .unique();
    if (!sub) {
      return {
        hasAccess: false,
        tier: "free" as const,
        status: null,
        currentPeriodEnd: null,
        role: profile.role ?? null,
        bypassed: false,
      };
    }

    // Recalcular hasAccess en la query (no delegamos a hasPremiumAccess
    // porque ya tenemos el doc cargado — ahorramos una query extra).
    let hasAccess = false;
    if (sub.tier === "premium" && ACCESS_GRANTING_STATES.has(sub.status)) {
      if (sub.status === "canceled") {
        hasAccess = !!sub.currentPeriodEnd && sub.currentPeriodEnd >= Date.now();
      } else {
        hasAccess = true;
      }
    }

    return {
      hasAccess,
      tier: sub.tier,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
      role: profile.role ?? null,
      bypassed: false,
    };
  },
});

// ---------------------------------------------------------------------------
// Admin queries (métricas simples, usadas en /admin/...)
// ---------------------------------------------------------------------------

/** Conteo de suscripciones por tier. Para el dashboard admin.
 *  No expone datos personales — solo números. */
export const getSubscriptionStats = query({
  args: {},
  handler: async (ctx) => {
    // Para esta query asumimos que el llamante ya pasó por el check de admin
    // en su Server Component / mutation. Aquí no replicamos la auth porque
    // no devuelve PII.
    const all = await ctx.db.query("subscriptions").collect();
    const byTier: Record<string, number> = { free: 0, premium: 0 };
    const byStatus: Record<string, number> = {};
    for (const sub of all) {
      byTier[sub.tier] = (byTier[sub.tier] ?? 0) + 1;
      byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
    }
    return {
      total: all.length,
      byTier,
      byStatus,
    };
  },
});

// ---------------------------------------------------------------------------
// Action: entrypoint público para el webhook handler
// ---------------------------------------------------------------------------
// ¿Por qué una action y no una mutation?
//   - El webhook de Clerk corre en Next.js (no en Convex) y usa
//     ConvexHttpClient. Para llamar a una `internalMutation` desde
//     fuera de Convex, hay que pasar por una `action` que es la
//     única callable pública sin auth de usuario.
//   - La action valida el input una segunda vez (defensa en profundidad)
//     y delega a la internal mutation que es la que realmente escribe.
//
// Idempotencia: la internal mutation usa `by_clerk_subscription_id`
// para upsert, así que llamar dos veces con el mismo evento es seguro.
// Si Clerk reintenta por timeout, acabamos con la misma fila, no
// duplicados.
// ---------------------------------------------------------------------------
export const handleClerkBillingEvent = action({
  args: {
    eventType: v.string(),
    eventId: v.string(),
    subscription: clerkSubscriptionPayload,
  },
  handler: async (ctx, args) => {
    // Defensa en profundidad: rechazar eventos con campos vacíos críticos
    // ANTES de gastar el write a la DB.
    if (!args.subscription.id) {
      throw new Error("handleClerkBillingEvent: subscription.id vacío");
    }
    if (!args.subscription.user_id) {
      // Como se documenta en upsertFromClerkEvent, sin user_id no podemos
      // asociar la sub a un usuario. Logueamos y NO lanzamos para que
      // el webhook responda 200 (si lanzamos, Clerk reintenta y nunca
      // tendremos user_id — sería un bucle).
      console.warn(
        `[subscriptions.handleClerkBillingEvent] sin user_id, se ignora. eventId=${args.eventId}`,
      );
      return { skipped: true, reason: "no_user_id" as const };
    }

    return await ctx.runMutation(internal.subscriptions.upsertFromClerkEvent, args);
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (solo desde el webhook handler)
// ---------------------------------------------------------------------------

/** Tipos de eventos que Clerk Billing nos envía. Documentados en
 *  https://clerk.com/docs/billing/webhooks
 *  La lista puede crecer cuando Clerk añada más eventos. Si llega un
 *  evento desconocido, el handler lo ignora silenciosamente (no es un
 *  error — solo no tenemos lógica para él). */
export const CLERK_BILLING_EVENT_TYPES = [
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.past_due",
  "subscription.canceled",
  "subscription.trialing",
  "subscriptionItem.created",
  "subscriptionItem.updated",
] as const;

/** Deriva el tier lógico ("free" | "premium") a partir del plan_id de Clerk.
 *  Convención: si el plan_id contiene "premium" (case-insensitive) → premium.
 *  Esto es robusto a que se añadan "premium_monthly", "premium_yearly",
 *  "premium_v2", "premium_lifetime", etc. sin tocar código.
 *  Si el plan_id no contiene "premium" → "free" (default safe).
 *
 *  Centralizar esta lógica aquí para que en el futuro, cuando se añada
 *  otro tier (e.g. "team"), solo haya que cambiar este switch. */
function deriveTierFromPlanId(planId: string | undefined): "free" | "premium" {
  if (!planId) return "free";
  const id = planId.toLowerCase();
  if (id.includes("premium")) return "premium";
  // Cuando se añadan tiers: if (id.includes("team")) return "team";
  return "free";
}

/** Upsert idempotente de una suscripción a partir de un evento de Clerk.
 *  Llamado desde el webhook handler. Si la sub no existe, la crea.
 *  Si existe, la actualiza con la info fresca de Clerk.
 *
 *  Usamos `internalMutation` porque:
 *   1) Nadie del cliente debe poder escribir aquí (es un mirror del estado
 *      de pago — manipularlo desde el cliente sería un agujero de seguridad).
 *   2) El handler de webhook ya validó la firma Svix, así que la fuente
 *      es confiable. */
export const upsertFromClerkEvent = internalMutation({
  args: {
    eventType: v.string(),
    eventId: v.string(),
    subscription: clerkSubscriptionPayload,
  },
  handler: async (ctx, { eventType, eventId, subscription }) => {
    // Clerk a veces envía user_id como "user_xxx" o no lo envía (pago
    // sin cuenta aún). Si no hay user_id, no podemos asociar — guardamos
    // el evento en log pero no creamos fila.
    if (!subscription.user_id) {
      console.warn(
        `[subscriptions.upsertFromClerkEvent] evento ${eventType} sin user_id, no se puede upsert. eventId=${eventId}`,
      );
      return { skipped: true, reason: "no_user_id" as const };
    }

    // Normalizar status al union de Convex. Si Clerk añade un estado nuevo
    // que no contemplamos, lo guardamos como "active" defensivamente
    // (mejor dar acceso que bloquear al usuario en una transición de estado).
    // (Manejado más abajo al construir el patch.)

    const tier = deriveTierFromPlanId(subscription.plan_id);

    // Buscar fila existente por clerk_subscription_id (1 sub = 1 fila).
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_subscription_id", (q) =>
        q.eq("clerkSubscriptionId", subscription.id),
      )
      .unique();

    const now = Date.now();

    // Construir el patch con los campos que Clerk nos envía. Usamos el
    // union de status directamente — si Clerk envía un status que no
    // está en el union, el validator del mutation fallará y sabremos
    // que tenemos que añadirlo.
    const patch = {
      clerkUserId: subscription.user_id,
      clerkSubscriptionId: subscription.id,
      planId: subscription.plan_id ?? "unknown",
      planName: subscription.plan_name ?? "",
      tier,
      status: subscription.status as
        | "active" | "trialing" | "past_due" | "canceled"
        | "incomplete" | "incomplete_expired" | "unpaid" | "paused",
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at,
      customerId: subscription.customer_id,
      customerEmail: subscription.customer_email,
      amountCents: subscription.amount_cents,
      currency: subscription.currency,
      lastSyncedAt: now,
      lastEventType: eventType,
      lastEventId: eventId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { skipped: false, action: "updated" as const, id: existing._id };
    }

    const id = await ctx.db.insert("subscriptions", {
      ...patch,
      createdAt: now,
    });
    return { skipped: false, action: "created" as const, id };
  },
});

/** Cancelación explícita: cuando Clerk nos dice que la sub está
 *  cancelada y el periodo ya venció, o cuando el usuario borra su
 *  cuenta, queremos que el tier vuelva a "free" para que el feature
 *  gating le corte el acceso al instante. */
export const downgradeToFree = internalMutation({
  args: {
    clerkUserId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { clerkUserId, reason }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!sub) return { skipped: true };

    await ctx.db.patch(sub._id, {
      tier: "free",
      status: "canceled",
      canceledAt: Date.now(),
      lastSyncedAt: Date.now(),
      lastEventType: reason ?? "downgradeToFree",
    });
    return { skipped: false, id: sub._id };
  },
});

/** Borrado físico de la fila de suscripción. Usado cuando el usuario
 *  elimina su cuenta de Clerk (evento `user.deleted`): por RGPD, el
 *  usuario se fue y no debe quedar rastro de su suscripción en nuestra
 *  BD. Idempotente: si no hay fila, devuelve skipped=true. */
export const purgeSubscriptionByClerkUserId = internalMutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!sub) return { skipped: true };
    await ctx.db.delete(sub._id);
    return { skipped: false, id: sub._id };
  },
});
