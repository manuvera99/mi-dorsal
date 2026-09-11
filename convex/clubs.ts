// =============================================================================
// mi-dorsal — Clubs (Sprint 4 · C1)
// =============================================================================
// Capa de "comunidad de clubs" sobre clubsCatalog. NO reemplaza la
// `clubsCatalog` existente: la reutiliza. Esta capa añade:
//
//   1. Membresía (clubMemberships): un corredor "pertenece" a un club.
//   2. Queries públicas para SEO:
//      - getCatalogForList: top clubs con nº de socios y km de la temporada
//        (placeholder 0 hasta C3 monte el cron clubSeasonRollup).
//      - getBySlug: ficha pública de un club con capitán, miembros y podium.
//      - getSeasonRankingPlaceholder: top N por nº de socios (proxy de km
//        hasta C3). Devuelve datos derivados de clubMemberships, no
//        requiere cron.
//   3. Mutations premium (joinClub, leaveClub) detrás de hasPremiumAccess.
//
// Convenciones:
//   - Las queries públicas devuelven null si el club no existe o está
//     inactivo, no lanzan error. Las páginas Server Component las manejan.
//   - Las mutations validan con requireUser y hasPremiumAccess; si falla,
//     error legible. Mensajes en español (consistente con el resto).
//   - Para evitar TS2589, ctx se tipa con la union de QueryCtx|MutationCtx
//     en los helpers reutilizables. Las funciones exported mantienen la
//     inferencia de Convex.
// =============================================================================

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getOptionalUser, requireUser, slugify } from "./_helpers";
import { hasPremiumAccess } from "./subscriptions";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Forma pública de un club para las páginas de catálogo y ficha.
 *  Construida a partir de clubsCatalog + conteo de miembros activos. */
type PublicClub = {
  _id: string;
  slug: string;
  name: string;
  ccaa: string;
  source: "manual" | "from_suggestion";
  memberCount: number;
  /** Km acumulados del club en la temporada en curso.
   *  En C1 devolvemos 0 (placeholder) hasta que C3 monte el cron
   *  clubSeasonRollup. La UI ya está preparada para mostrarlo. */
  seasonDistanceKm: number;
  /** Dorsales finalizados por miembros en la temporada (placeholder 0). */
  seasonRacesFinished: number;
};

type ClubCtx = QueryCtx | MutationCtx;

// ---------------------------------------------------------------------------
// Helpers internos (no se exportan)
// ---------------------------------------------------------------------------

/** Construye el slug URL-safe a partir del nombre. Usa el slugify central
 *  de _helpers.ts para mantener consistencia con el resto del proyecto. */
function clubSlug(name: string): string {
  return slugify(name);
}

/** Cuenta los miembros activos de un club. Una membresía es activa si
 *  leftAt es undefined o null. */
async function countActiveMembers(
  ctx: ClubCtx,
  clubCatalogId: Id<"clubsCatalog">,
): Promise<number> {
  // Listamos todas las membresías del club y filtramos en JS: a fecha de
  // C1 esperamos < 100 miembros por club, el escaneo en memoria es
  // aceptable. Si crece, cambiar a query con índice `by_club_active`.
  const all = await ctx.db.query("clubMemberships").collect();
  return all.filter(
    (m) => m.clubCatalogId === clubCatalogId && m.leftAt == null,
  ).length;
}

// ---------------------------------------------------------------------------
// QUERIES PÚBLICAS (sin auth)
// ---------------------------------------------------------------------------

/** Lista los clubs del catálogo para `/clubs` y el sitemap.
 *  Orden: número de socios desc (los clubes grandes arriba), luego nombre
 *  asc como tiebreaker determinista. Limit 200 por defecto — esperamos
 *  < 1000 clubs a medio plazo, y la página solo necesita el top. */
export const getCatalogForList = query({
  args: {
    ccaa: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PublicClub[]> => {
    return await buildCatalog(ctx, args);
  },
});

/** Implementación interna de getCatalogForList, reusada por
 *  getSeasonRankingPlaceholder sin pasar por la capa RegisteredQuery
 *  (que no expone `.handler` para invocarse desde otra query). */
async function buildCatalog(
  ctx: ClubCtx,
  args: { ccaa?: string; limit?: number },
): Promise<PublicClub[]> {
  const limit = args.limit ?? 200;
  const all = await ctx.db.query("clubsCatalog").collect();
  const active = all.filter((c) => c.isActive !== false);

  // Filtro opcional por CCAA (case-insensitive)
  const filtered = args.ccaa
    ? active.filter(
        (c) => c.ccaa.toLowerCase() === args.ccaa!.toLowerCase(),
      )
    : active;

  // Enriquecer con nº de socios. Hacemos el conteo club por club:
  // < 1000 clubs, < 10 socios/club de media → 10k filas como techo
  // absoluto, escaneables.
  const enriched = await Promise.all(
    filtered.map(async (c) => {
      const memberCount = await countActiveMembers(ctx, c._id);
      return {
        _id: c._id,
        slug: clubSlug(c.name),
        name: c.name,
        ccaa: c.ccaa,
        source: c.source,
        memberCount,
        // Placeholder hasta C3 (clubSeasonRollup):
        seasonDistanceKm: 0,
        seasonRacesFinished: 0,
      };
    }),
  );

  enriched.sort((a, b) => {
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    return a.name.localeCompare(b.name, "es");
  });

  return enriched.slice(0, limit);
}

/** Devuelve la ficha pública de un club por slug. Null si no existe o
 *  está inactivo. Incluye capitán (resuelto desde createdBy), nº de socios
 *  y podium top-5 de miembros por nombre (placeholder en C1: ordenamos
 *  por joinedAt asc, sin stats hasta C3). */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const targetSlug = args.slug;
    const all = await ctx.db.query("clubsCatalog").collect();
    const club = all.find(
      (c) => c.isActive !== false && clubSlug(c.name) === targetSlug,
    );
    if (!club) return null;

    // Capitán = creador del club (no hay rol "capitán" en C1).
    const captain = await ctx.db.get(club.createdBy);

    // Miembros activos (top 5 por joinedAt asc — los más "antiguos" primero)
    const memberships = await ctx.db.query("clubMemberships").collect();
    const activeMemberships = memberships
      .filter((m) => m.clubCatalogId === club._id && m.leftAt == null)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .slice(0, 5);

    const members = await Promise.all(
      activeMemberships.map(async (m) => {
        const profile = await ctx.db.get(m.profileId);
        return {
          _id: m._id,
          joinedAt: m.joinedAt,
          dorsalNumber: m.dorsalNumber ?? null,
          profile: profile
            ? {
                _id: profile._id,
                displayName: profile.displayName ?? null,
                avatarUrl: profile.avatarUrl ?? null,
              }
            : null,
        };
      }),
    );

    return {
      _id: club._id,
      slug: clubSlug(club.name),
      name: club.name,
      ccaa: club.ccaa,
      source: club.source,
      createdAt: club.createdAt,
      memberCount: activeMemberships.length,
      captain: captain
        ? {
            _id: captain._id,
            displayName: captain.displayName ?? "Capitán",
          }
        : null,
      members,
      // Placeholders hasta C3
      seasonDistanceKm: 0,
      seasonRacesFinished: 0,
    };
  },
});

/** Ranking público de clubs para `/ranking/clubes`. Placeholder C1:
 *  ordenamos por nº de socios desc (proxy de "actividad"). Cuando C3
 *  monte clubSeasonRollup, esta query pasa a leer club_season_stats. */
export const getSeasonRankingPlaceholder = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const list = await buildCatalog(ctx, { limit: 1000 });
    return list.slice(0, limit);
  },
});

// ---------------------------------------------------------------------------
// QUERIES AUTENTICADAS
// ---------------------------------------------------------------------------

/** Devuelve la membresía activa del usuario actual, o null. */
export const getMyMembership = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getOptionalUser(ctx);
    if (!profile) return null;
    const all = await ctx.db.query("clubMemberships").collect();
    const active = all.find(
      (m) => m.profileId === profile._id && m.leftAt == null,
    );
    if (!active) return null;
    const club = await ctx.db.get(active.clubCatalogId);
    if (!club) return null;
    return {
      _id: active._id,
      joinedAt: active.joinedAt,
      dorsalNumber: active.dorsalNumber ?? null,
      club: {
        _id: club._id,
        slug: clubSlug(club.name),
        name: club.name,
        ccaa: club.ccaa,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS PREMIUM
// ---------------------------------------------------------------------------

/** Une al usuario actual a un club del catálogo. Requiere Pro (o admin/test).
 *  Reglas:
 *   - El club debe existir y estar activo.
 *   - El usuario no puede estar ya en otro club activo (debe salir primero).
 *   - Sincroniza profiles.club con el nombre canónico para que el
 *     ClubSelect siga mostrando el club correcto en /perfil (migración
 *     no-disruptiva desde la versión string-only).
 */
export const joinClub = mutation({
  args: {
    clubCatalogId: v.id("clubsCatalog"),
    dorsalNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);
    const isPremium = await hasPremiumAccess(ctx, profile.clerkUserId);
    if (!isPremium) {
      throw new Error(
        "Unirse a un club es una función Premium. Hazte Dorsal Pro para sumar dorsales con tu club.",
      );
    }

    // Club existe y está activo
    const club = await ctx.db.get(args.clubCatalogId);
    if (!club || club.isActive === false) {
      throw new Error("Club no encontrado o inactivo");
    }

    // El usuario no debe estar ya en otro club activo
    const allMemberships = await ctx.db.query("clubMemberships").collect();
    const existing = allMemberships.find(
      (m) => m.profileId === profile._id && m.leftAt == null,
    );
    if (existing) {
      throw new Error(
        "Ya perteneces a un club. Sal del actual antes de unirte a otro.",
      );
    }

    // Validar dorsalNumber si viene
    let dorsal: string | undefined = undefined;
    if (args.dorsalNumber && args.dorsalNumber.trim().length > 0) {
      const trimmed = args.dorsalNumber.trim().slice(0, 12);
      if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
        throw new Error("El dorsal solo puede contener letras, números y guiones");
      }
      dorsal = trimmed;
    }

    const now = Date.now();
    const membershipId = await ctx.db.insert("clubMemberships", {
      clubCatalogId: args.clubCatalogId,
      profileId: profile._id,
      joinedAt: now,
      ...(dorsal ? { dorsalNumber: dorsal } : {}),
    });

    // Sincronizar profiles.club (legacy string) para que el ClubSelect
    // siga funcionando. Lo hacemos aquí para que el cambio sea
    // transaccional con el insert de la membresía.
    await ctx.db.patch(profile._id, { club: club.name });

    return membershipId;
  },
});

/** Saca al usuario actual de su club activo. Idempotente: si no está
 *  en ninguno, no hace nada. */
export const leaveClub = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    const isPremium = await hasPremiumAccess(ctx, profile.clerkUserId);
    if (!isPremium) {
      throw new Error("Salir de un club requiere Dorsal Pro.");
    }
    const allMemberships = await ctx.db.query("clubMemberships").collect();
    const active = allMemberships.find(
      (m) => m.profileId === profile._id && m.leftAt == null,
    );
    if (!active) return { skipped: true, reason: "not_in_club" as const };

    await ctx.db.patch(active._id, { leftAt: Date.now() });

    // Limpiar profiles.club solo si coincide con el nombre del club
    // (no pisar si el usuario lo cambió a mano en el ClubSelect).
    const club = await ctx.db.get(active.clubCatalogId);
    if (club && profile.club === club.name) {
      await ctx.db.patch(profile._id, { club: undefined });
    }

    return { skipped: false, id: active._id };
  },
});
