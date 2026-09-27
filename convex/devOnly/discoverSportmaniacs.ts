// =============================================================================
// mi-dorsal — DEV ONLY: discover-sportmaniacs (por nombre)
// =============================================================================
// Sesión 27 sep 2026 — segunda capa de discovery para carreras sportmaniacs
// huérfanas:
//
//   1. Capa actual (en `crons/checkResults.ts`): si la carrera tiene
//      `sportmaniacsEventIds` vacío, intenta parsear `officialUrl`
//      (debe ser de sportmaniacs.com) y extraer `<div class="event-card">`.
//      Funciona para la mayoría de carreras porque tienen `sourceUrl`
//      apuntando a sportmaniacs.
//
//   2. Esta capa (manual): cuando la capa 1 falla porque `officialUrl`
//      apunta a OTRO dominio (típico de homologación: el equipo de
//      carreras ha sobreescrito officialUrl con la web del organizador
//      tras integrar la carrera al catálogo de mi-dorsal), recurrimos a
//      la search API pública de Sportmaniacs.
//
// Por qué está estructurado como action + mutation wrapper:
//   - La lógica de fetch (con setTimeout para AbortController) debe
//     correr en una `internalAction` — Convex prohíbe `fetch()` y
//     `setTimeout()` en queries/mutations.
//   - El wrapper `internalMutation` no se usa directamente: la action
//     llama a `cacheDiscoveredEventIds` (internalMutation) vía
//     `ctx.runMutation`.
//
// ⚠️ NO auto-disparar desde el cron: paginar sportmaniacs puede llevar
// hasta 12 fetches × 5s = ~60s por carrera. Solo el admin dispara esto.
//
// Uso:
//   npx convex run --prod devOnly/discoverSportmaniacs:discoverSportmaniacs '{
//     "raceId":"k572ykykjrabvb285sjzf1bg5s8dpttk",
//     "confirm":"discover-sportmaniacs-orphans"
//   }'
// =============================================================================

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { SportmaniacsEventRef } from "../scraper";

// =============================================================================
// Action principal: orquesta fetch + paginación + cache.
// Convex permite `fetch()` y `setTimeout()` solo en actions.
// =============================================================================

export const discoverSportmaniacs = internalAction({
  args: {
    raceId: v.id("races"),
    confirm: v.literal("discover-sportmaniacs-orphans"),
  },
  handler: async (ctx, args) => {
    const race: any = await ctx.runQuery(
      internal.devOnly.discoverSportmaniacs.getRacePublic,
      { raceId: args.raceId },
    );
    if (!race) throw new Error(`race ${args.raceId} no existe`);

    if (race.scraperAdapter !== "sportmaniacs") {
      throw new Error(
        `Esta carrera no es sportmaniacs (scraperAdapter=${race.scraperAdapter}). Nada que descubrir.`,
      );
    }
    if (race.sportmaniacsEventIds && race.sportmaniacsEventIds.length > 0) {
      return {
        ok: false,
        skipped: true,
        reason: "ya tiene sportmaniacsEventIds cacheados",
        cachedCount: race.sportmaniacsEventIds.length,
      };
    }

    // Import dinámico dentro de la action — el módulo scraper.ts puede
    // tener dependencias que solo se cargan en runtime Node.
    const { discoverSportmaniacsEventIdsByName } = await import("../scraper");

    const eventIds: SportmaniacsEventRef[] =
      await discoverSportmaniacsEventIdsByName(
        race.name,
        race.startDate,
        race.locality ?? undefined,
      );

    if (eventIds.length === 0) {
      return {
        ok: false,
        skipped: true,
        reason:
          "no se encontró match único para esta carrera en sportmaniacs (paginación agotada o desambiguación imposible)",
        raceName: race.name,
        raceStartDate: race.startDate,
      };
    }

    // Cachear via internalMutation (la action no puede escribir directo).
    await ctx.runMutation(
      internal.devOnly.discoverSportmaniacs.cacheDiscoveredEventIds,
      { raceId: args.raceId, eventIds },
    );

    return {
      ok: true,
      eventIdsCount: eventIds.length,
      eventIds,
      raceName: race.name,
      raceStartDate: race.startDate,
      nextStep:
        "Ahora ejecuta: npx convex run --prod crons/checkResults:checkResults '{}' (la carrera ya debería aparecer)",
    };
  },
});

// =============================================================================
// Helpers internos (internalQuery + internalMutation). No se exponen al cliente.
// =============================================================================

export const getRacePublic = internalQuery({
  args: {
    raceId: v.id("races"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.raceId);
  },
});

export const cacheDiscoveredEventIds = internalMutation({
  args: {
    raceId: v.id("races"),
    eventIds: v.array(
      v.object({
        eventId: v.string(),
        name: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.raceId, {
      sportmaniacsEventIds: args.eventIds,
    });
    return { ok: true };
  },
});
