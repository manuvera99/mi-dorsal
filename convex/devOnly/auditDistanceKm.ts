// =============================================================================
// mi-dorsal — Dev/admin: auditDistanceKm
// =============================================================================
// Lista carreras con `distanceKm` que parecen provenir del bug del scraper
// de carreraspopulares.com (matcheaba el día/año de la fecha como distancia).
//
// Usar:
//   npx convex run --prod devOnly/auditDistanceKm:audit '{}'
//
// Devuelve carreras donde distanceKm está en rangos típicos del bug:
//   - 1..31  (día del mes)
//   - 2020..2035 (año partido)
//   - 2.020..2.035 (año partido por la "M" de "Maratón" en el HTML)
//
// También incluye el nombre y la fuente para detectar falsos positivos
// (carreras de 5K, 10K, carreras por etapas, etc.) y validar manualmente.
// =============================================================================

import { query } from "../_generated/server";

const DAY_LIKE = (km: number) => km >= 1 && km <= 31 && Number.isInteger(km);
const YEAR_LIKE = (km: number) =>
  (km >= 2020 && km <= 2035) || (km >= 2.02 && km <= 2.035);

export const audit = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("races").collect();

    type SuspiciousRow = {
      _id: string;
      slug: string;
      name: string;
      distanceKm: number;
      startDate?: string;
      scraperAdapter?: string;
      reason: string;
    };
    const suspicious: SuspiciousRow[] = [];

    for (const r of all) {
      const km = r.distanceKm;
      if (typeof km !== "number") continue;
      let reason: string | null = null;
      if (DAY_LIKE(km)) reason = "day-of-month";
      else if (YEAR_LIKE(km)) reason = "year-fragment";
      if (!reason) continue;
      suspicious.push({
        _id: String(r._id),
        slug: r.slug,
        name: r.name,
        distanceKm: km,
        startDate: r.startDate,
        scraperAdapter: r.scraperAdapter,
        reason,
      });
    }

    // Ordenar por razón + nombre para inspección
    suspicious.sort((a, b) =>
      a.reason === b.reason ? a.name.localeCompare(b.name) : a.reason.localeCompare(b.reason)
    );

    return {
      total: all.length,
      suspiciousCount: suspicious.length,
      suspicious,
    };
  },
});
