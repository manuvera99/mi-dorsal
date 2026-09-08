// =============================================================================
// mi-dorsal — Mock data provider (replacement for Convex when in mock mode)
// =============================================================================

import {
  MOCK_RACES,
  MOCK_RACES_FROM_SCRAPERS,
  MOCK_PROFILE,
  MOCK_PRS,
  MOCK_MY_RACES,
  MOCK_RATINGS,
  MockRace,
} from "./data";

const ALL_MOCK_RACES: MockRace[] = [...MOCK_RACES, ...MOCK_RACES_FROM_SCRAPERS];

export function isMockMode(): boolean {
  // Cliente: comprobar window override primero (sin tocar process)
  if (typeof window !== "undefined" && (window as any).__NEXT_PUBLIC_USE_MOCK__ === true) {
    return true;
  }
  // SSR / build time: process.env existe, Next.js hace inline replacement
  // de NEXT_PUBLIC_USE_MOCK en build time si la referencia es directa.
  if (typeof window === "undefined" && process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    return true;
  }
  return false;
}

// Misma lógica que en convex/races.ts — duplicado intencional para no
// importar desde la capa Convex en modo mock.
function distanceToCategories(distanceKm: number): string[] {
  if (typeof distanceKm !== "number" || distanceKm <= 0) return [];
  const out: string[] = [];
  if (distanceKm >= 0    && distanceKm < 7.5)   out.push("5k");
  if (distanceKm >= 7.5  && distanceKm < 12.5)  out.push("10k");
  if (distanceKm >= 12.5 && distanceKm < 17.5)  out.push("15k");
  if (distanceKm >= 17.5 && distanceKm < 23)    out.push("half_marathon");
  if (distanceKm >= 40   && distanceKm < 44)    out.push("marathon");
  if (distanceKm >= 44)                         out.push("ultra");
  return out;
}

// Mock implementations de queries
export const mockApi = {
  races: {
    list: async (args: any = {}) => {
      let filtered = ALL_MOCK_RACES.filter((r) => r.isPublished);
      if (args.fromDate) {
        filtered = filtered.filter(
          (r) => typeof r.startDate === "string" && r.startDate >= args.fromDate,
        );
      }
      if (args.province) filtered = filtered.filter((r) => r.province === args.province);
      if (args.raceType) filtered = filtered.filter((r) => r.raceType === args.raceType);
      if (args.month) {
        filtered = filtered.filter((r) => {
          if (!r.startDate) return false;
          return new Date(r.startDate).getMonth() + 1 === args.month;
        });
      }
      if (args.search) {
        const s = args.search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.name.toLowerCase().includes(s) ||
            r.locality?.toLowerCase().includes(s) ||
            (r as { organizer?: string }).organizer?.toLowerCase().includes(s),
        );
      }
      if (args.organizer) {
        const o = args.organizer.toLowerCase();
        filtered = filtered.filter(
          (r) => (r as { organizer?: string }).organizer?.toLowerCase() === o,
        );
      }
      if (args.distanceCategories && args.distanceCategories.length > 0) {
        filtered = filtered.filter((r) => {
          const cats = distanceToCategories(r.distanceKm);
          return cats.some((c) => args.distanceCategories.includes(c));
        });
      }
      filtered.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
      return args.limit ? filtered.slice(0, args.limit) : filtered;
    },
    getBySlug: async ({ slug }: { slug: string }) => {
      return ALL_MOCK_RACES.find((r) => r.slug === slug) ?? null;
    },
    getFeatured: async ({ limit = 6 }: { limit?: number } = {}) => {
      return ALL_MOCK_RACES.filter((r) => r.isFeatured).slice(0, limit);
    },
    listOrganizers: async () => {
      const counts = new globalThis.Map<string, number>();
      for (const r of ALL_MOCK_RACES) {
        const org = (r as { organizer?: string }).organizer?.trim();
        if (!org) continue;
        counts.set(org, (counts.get(org) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    },
  },
  ratings: {
    summary: async ({ raceId }: { raceId: string }) => {
      const ratings = MOCK_RATINGS[raceId] ?? [];
      if (ratings.length === 0) {
        return { totalRatings: 0, avgGlobal: null, avgOrganization: null, avgPrice: null, avgSwag: null, avgAidStations: null, avgCourse: null, avgAtmosphere: null, avgPostRace: null, avgTrophies: null };
      }
      const keys = ["organization", "price", "swag", "aidStations", "course", "atmosphere", "postRace", "trophies"];
      const avgs: any = {};
      for (const k of keys) {
        const vals = ratings.map((r: any) => r[k]).filter((v: any) => typeof v === "number");
        avgs[`avg${k.charAt(0).toUpperCase() + k.slice(1)}`] = vals.length > 0 ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 100) / 100 : null;
      }
      const validAvgs = Object.values(avgs).filter((v): v is number => typeof v === "number");
      avgs.avgGlobal = validAvgs.length > 0 ? Math.round((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) * 100) / 100 : null;
      avgs.totalRatings = ratings.length;
      return avgs;
    },
    topRaces: async ({
      limit = 10,
      fromDate,
    }: { limit?: number; fromDate?: string } = {}) => {
      const sourceRaces =
        fromDate
          ? MOCK_RACES.filter(
              (r) => typeof r.startDate === "string" && r.startDate >= fromDate,
            )
          : MOCK_RACES;
      const racesWithRatings = await Promise.all(
        sourceRaces.map(async (race) => {
          const summary = await mockApi.ratings.summary({ raceId: race._id });
          if (summary.totalRatings < 3) return null;
          return { ...race, ...summary };
        }),
      );
      return racesWithRatings
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => (b.avgGlobal ?? 0) - (a.avgGlobal ?? 0))
        .slice(0, limit);
    },
  },
  users: {
    getMyProfile: async () => MOCK_PROFILE,
    /**
     * Mock de `api.users.upsertMyProfile` (Convex). Mismas reglas que el
     * backend real: birthDate se valida como YYYY-MM-DD ≤ hoy; strings vacíos
     * se interpretan como "borrar". Mutamos MOCK_PROFILE in-place para que
     * `getMyProfile` (que devuelve la referencia) refleje el cambio en el
     * siguiente render del cliente.
     */
    updateMyProfile: async (patch: {
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      club?: string;
      birthDate?: string | null;
    }) => {
      // Cast a `any` solo en este mock: MOCK_PROFILE está tipado como literal
      // con `birthDate: "1991-05-12"` (requerido), así que TS se queja al
      // reasignar o borrar esa propiedad. En el backend real, `birthDate`
      // es opcional y el patch es natural. Re-tiparlo en data.ts sería
      // invasivo para un mock.
      const p = MOCK_PROFILE as any;
      if (patch.displayName !== undefined) p.displayName = patch.displayName;
      if (patch.avatarUrl !== undefined) p.avatarUrl = patch.avatarUrl;
      if (patch.bio !== undefined) p.bio = patch.bio;
      if (patch.club !== undefined) p.club = patch.club;
      if (patch.birthDate !== undefined) {
        const v = patch.birthDate;
        if (v == null || v === "") {
          delete p.birthDate;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          const parsed = new Date(`${v}T00:00:00Z`);
          if (!Number.isNaN(parsed.getTime())) {
            p.birthDate = v;
          }
        }
      }
      return { ...p };
    },
  },
  myRaces: {
    listMine: async ({ status }: { status?: string } = {}) => {
      let list = MOCK_MY_RACES;
      if (status) list = list.filter((m) => m.status === status);
      return list.map((m) => ({ ...m, race: MOCK_RACES.find((r) => r._id === m.raceId) }));
    },
  },
  personalRecords: {
    listMine: async () => MOCK_PRS,
  },
  clubSuggestions: {
    /**
     * Mock de `api.clubSuggestions.submit` (Convex). Acepta la misma forma
     * de payload y devuelve un id falso. En dev no se persiste: solo sirve
     * para que el flujo de UI (dialog → loading → confirmación) funcione
     * sin necesidad de tener Convex configurado.
     */
    submit: async (input: {
      clubName: string;
      ccaa?: string;
      note?: string;
      contactEmail?: string;
    }) => {
      console.info("[mock] clubSuggestions.submit", input);
      return { id: `mock_suggestion_${Date.now()}` as any };
    },
  },
};
