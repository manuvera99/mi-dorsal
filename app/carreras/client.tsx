"use client";

/**
 * ClientCarreras — versión interactiva de /carreras.
 *
 * Estructura:
 *  1. Hero compacto con buscador y comunidad detectada
 *  2. Filtro de ubicación (GPS + slider) — solo si se activa
 *  3. Quick-access chips (distancia + mes)
 *  4. Filtros avanzados plegables (provincia, tipo, organizadora)
 *  5. Carruseles por afinidad: Cerca de ti / Las más votadas / Próximamente
 *  6. Empty state emocional si no hay resultados
 *  7. Grid completo con el resto
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { Search, MapPin, List, Map, Calendar, X, ArrowUpDown, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";
import { RaceDistanceFilter } from "@/components/race-distance-filter";
import { RaceMapWrapper } from "@/components/race-map-wrapper";
import { RaceCarousel } from "@/components/carreras/race-carousel";
import { QuickFilterChips } from "@/components/carreras/quick-filter-chips";
import { AdvancedFilters } from "@/components/carreras/advanced-filters";
import { CarrerasHero } from "@/components/carreras/carreras-hero";
import { useUserRegion } from "@/components/use-user-region";
import { useCarrerasFilters, type CarrerasFilters } from "@/components/race-filters";
import { haversineDistanceKm, type Coords } from "@/lib/geo/distance";
import type { DistanceCategory } from "@/lib/utils";
import { cn } from "@/lib/utils";

function MockCarreras() {
  const [filters, setFilters] = useCarrerasFilters();
  const [races, setRaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    void mockApi.races.list(filters).then((r) => {
      setRaces(r);
      setLoading(false);
    });
    void mockApi.ratings.topRaces({ limit: 10 }).then(setTop);
  }, [JSON.stringify(filters)]);

  return (
    <CarrerasShell
      races={races}
      top={top}
      loading={loading}
      filters={filters}
      onChange={setFilters}
    />
  );
}

function RealCarreras() {
  const [filters, setFilters] = useCarrerasFilters();
  const convexRaces = useQuery(api.races.list, {
    province: filters.province as any,
    raceType: filters.raceType as any,
    month: filters.month,
    search: filters.search,
    organizer: filters.organizer,
    distanceCategories: filters.distanceCategories as any,
  });
  const top = useQuery(api.ratings.topRaces, { limit: 10 });
  const loading = convexRaces === undefined;
  return (
    <CarrerasShell
      races={(convexRaces as any) ?? []}
      top={(top as any) ?? []}
      loading={loading}
      filters={filters}
      onChange={setFilters}
    />
  );
}

export function ClientCarreras() {
  const [mounted, setMounted] = useState(false);
  const [useMock, setUseMock] = useState(false);
  useEffect(() => {
    setMounted(true);
    setUseMock(isMockMode());
  }, []);
  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="text-center py-12 text-gray-500">Cargando catálogo…</div>
      </div>
    );
  }
  return useMock ? <MockCarreras /> : <RealCarreras />;
}

// =============================================================================
// Shell que recibe los datos ya cargados y se encarga de presentación
// =============================================================================

interface CarrerasShellProps {
  races: any[];
  top: any[];
  loading: boolean;
  filters: CarrerasFilters;
  onChange: (f: CarrerasFilters) => void;
}

function CarrerasShell({ races, top, loading, filters, onChange }: CarrerasShellProps) {
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(200);
  const [filterEnabled, setFilterEnabled] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [sortBy, setSortBy] = useState<"date" | "name" | "votes">("date");
  const { community } = useUserRegion();

  const handleDistanceChange = useCallback((coords: Coords | null, maxKm: number) => {
    setUserCoords(coords);
    setMaxDistance(maxKm);
    setFilterEnabled(coords !== null);
  }, []);

  // Aplicar quick chips
  const handleSelectDistance = (d: DistanceCategory | null) => {
    onChange({ ...filters, distanceCategories: d ? [d] : undefined });
  };
  const handleSelectMonth = (m: number | null) => {
    onChange({ ...filters, month: m ?? undefined });
  };

  // Filtrar por distancia GPS si está activa
  const racesAfterDistance = useMemo(() => {
    if (!filterEnabled || !userCoords || maxDistance >= 300) return races;
    return races.filter((r) => {
      if (typeof r.latitude !== "number" || typeof r.longitude !== "number") return true;
      const d = haversineDistanceKm(userCoords, { latitude: r.latitude, longitude: r.longitude });
      return d <= maxDistance;
    });
  }, [races, userCoords, maxDistance, filterEnabled]);

  // Distancias desde el usuario
  const raceDistances = useMemo(() => {
    const map = new globalThis.Map<string, number>();
    if (!userCoords) return map;
    for (const r of racesAfterDistance) {
      if (typeof r.latitude === "number" && typeof r.longitude === "number") {
        map.set(
          r._id,
          haversineDistanceKm(userCoords, { latitude: r.latitude, longitude: r.longitude })
        );
      }
    }
    return map;
  }, [userCoords, racesAfterDistance]);

  // Carruseles por afinidad
  const { nearbyRaces, upcomingRaces, topVotedRaces } = useMemo(() => {
    const now = new Date();
    const sorted = [...racesAfterDistance].sort((a, b) =>
      (a.startDate ?? "").localeCompare(b.startDate ?? "")
    );
    const upcoming = sorted
      .filter((r) => r.startDate && new Date(r.startDate) >= now)
      .slice(0, 10);
    const inCommunity = community
      ? sorted.filter((r) =>
          community.provinces.includes((r.province ?? "").toLowerCase())
        )
      : [];
    return {
      nearbyRaces: inCommunity.slice(0, 10),
      upcomingRaces: upcoming,
      topVotedRaces: top.slice(0, 10),
    };
  }, [racesAfterDistance, community, top]);

  // Resto: lo que no sale en los carruseles, ordenado
  const featuredIds = useMemo(() => {
    const ids = new Set<string>();
    nearbyRaces.forEach((r) => ids.add(r._id));
    upcomingRaces.slice(0, 6).forEach((r) => ids.add(r._id));
    return ids;
  }, [nearbyRaces, upcomingRaces]);

  const restOfRaces = useMemo(() => {
    let list = racesAfterDistance.filter((r) => !featuredIds.has(r._id));
    switch (sortBy) {
      case "name":
        list = list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "votes":
        list = list.sort((a, b) => (b.totalRatings ?? 0) - (a.totalRatings ?? 0));
        break;
      case "date":
      default:
        list = list.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    }
    return list;
  }, [racesAfterDistance, featuredIds, sortBy]);

  // Active filter count
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.province ? 1 : 0) +
    (filters.raceType ? 1 : 0) +
    (filters.month ? 1 : 0) +
    (filters.organizer ? 1 : 0) +
    (filters.distanceCategories?.length ?? 0);

  const totalWithCoords = races.filter(
    (r) => typeof r.latitude === "number" && typeof r.longitude === "number"
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-8 space-y-6 md:space-y-8">
      {/* 1. HERO */}
      <CarrerasHero
        totalRaces={races.length}
        onSearch={(q) => onChange({ ...filters, search: q || undefined })}
        initialQuery={filters.search ?? ""}
      />

      {/* 2. UBICACIÓN GPS (opcional) */}
      <RaceDistanceFilter onChange={handleDistanceChange} initialMaxDistance={maxDistance} />

      {/* 3. QUICK-ACCESS CHIPS */}
      <QuickFilterChips
        selectedDistance={filters.distanceCategories?.[0] ?? null}
        selectedMonth={filters.month ?? null}
        onSelectDistance={handleSelectDistance}
        onSelectMonth={handleSelectMonth}
      />

      {/* 4. FILTROS AVANZADOS PLEGABLES */}
      <AdvancedFilters
        filters={filters}
        onChange={(patch) => onChange({ ...filters, ...patch })}
      />

      {/* 5. HEADER DE RESULTADOS + SORT + VIEW MODE */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <p className="text-sm font-semibold text-runner-dark">
            {loading
              ? "Buscando carreras…"
              : racesAfterDistance.length === 0
              ? "Sin resultados con esos filtros"
              : `${racesAfterDistance.length} ${
                  racesAfterDistance.length === 1 ? "carrera encontrada" : "carreras encontradas"
                }`}
          </p>
          {filterEnabled && (
            <p className="text-xs text-gray-500 mt-0.5">
              Dentro de {maxDistance >= 300 ? "España entera" : `${maxDistance} km de tu ubicación`}
              {races.length - racesAfterDistance.length > 0 &&
                ` · ${races.length - racesAfterDistance.length} ocultas por distancia`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            <select
              aria-label="Ordenar"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border border-gray-200 rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:border-runner-primary"
            >
              <option value="date">Más próximas</option>
              <option value="name">Nombre A-Z</option>
              <option value="votes">Más votadas</option>
            </select>
          </div>
          <div className="flex items-center bg-white border border-gray-300 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors",
                viewMode === "list"
                  ? "bg-runner-primary text-white"
                  : "text-gray-600 hover:text-runner-primary"
              )}
              aria-pressed={viewMode === "list"}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors",
                viewMode === "map"
                  ? "bg-runner-primary text-white"
                  : "text-gray-600 hover:text-runner-primary"
              )}
              aria-pressed={viewMode === "map"}
            >
              <Map className="h-3.5 w-3.5" /> Mapa
            </button>
          </div>
        </div>
      </div>

      {/* 6. CARRUSELES POR AFINIDAD (solo si NO hay filtros secundarios activos) */}
      {!loading && activeFilterCount === 0 && (
        <>
          {nearbyRaces.length > 0 && community && (
            <RaceCarousel
              title={`Cerca de ti · ${community.shortName}`}
              subtitle={`Carreras en ${community.name} que ya están abiertas o a punto de abrir inscripción`}
              icon={<MapPin className="h-5 w-5" />}
              races={nearbyRaces}
              distanceFromUser={(r) => raceDistances.get(r._id) ?? null}
              viewAllHref={`/carreras?provincia=${community.provinces[0]}`}
              viewAllLabel="Ver todas de tu zona"
            />
          )}

          {upcomingRaces.length > 0 && (
            <RaceCarousel
              title="Próximamente"
              subtitle="Las más cercanas en el calendario. Apúntate antes de que se agoten los dorsales."
              icon={<Calendar className="h-5 w-5" />}
              races={upcomingRaces.slice(0, 8)}
              distanceFromUser={(r) => raceDistances.get(r._id) ?? null}
            />
          )}

          {topVotedRaces.length > 0 && (
            <RaceCarousel
              title="Las más votadas por la comunidad"
              subtitle="El top 10 de carreras mejor valoradas por corredores como tú"
              icon={<Sparkles className="h-5 w-5" />}
              accent="amber"
              races={topVotedRaces}
            />
          )}
        </>
      )}

      {/* 7. MODO MAPA */}
      {viewMode === "map" ? (
        <>
          {filterEnabled && totalWithCoords < races.length && (
            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md p-2 flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {totalWithCoords} de {races.length} carreras tienen coordenadas y se muestran en
                el mapa. Las {races.length - totalWithCoords} sin coordenadas aparecen solo en
                lista.
              </span>
            </div>
          )}
          <RaceMapWrapper
            races={racesAfterDistance.filter(
              (r) => typeof r.latitude === "number" && typeof r.longitude === "number"
            )}
            userCoords={userCoords}
            maxDistanceKm={maxDistance}
          />
        </>
      ) : loading ? (
        <SkeletonGrid />
      ) : racesAfterDistance.length === 0 ? (
        <EmptyState
          hasFilter={activeFilterCount > 0}
          hasDistance={filterEnabled}
          maxDistance={maxDistance}
          onClear={() => onChange({})}
        />
      ) : (
        <>
          {featuredIds.size > 0 && activeFilterCount === 0 && (
            <h2 className="text-lg font-bold text-runner-dark pt-2">
              Todo el catálogo
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({restOfRaces.length} {restOfRaces.length === 1 ? "más" : "más"})
              </span>
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restOfRaces.map((race) => (
              <RaceCard
                key={race._id}
                race={race}
                distanceFromUser={raceDistances.get(race._id) ?? null}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-lg border border-gray-200 bg-white p-5 animate-pulse"
          aria-hidden="true"
        >
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-6" />
          <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  hasFilter: boolean;
  hasDistance: boolean;
  maxDistance: number;
  onClear: () => void;
}

function EmptyState({ hasFilter, hasDistance, maxDistance, onClear }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-runner-warm p-8 md:p-10 text-center">
      <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" aria-hidden="true" />
      {hasDistance ? (
        <>
          <p className="text-base font-semibold text-runner-dark mb-1">
            No hay carreras dentro de {maxDistance} km de tu ubicación.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Prueba a ampliar el radio, desactivar el filtro de ubicación, o explorar el catálogo
            completo.
          </p>
        </>
      ) : hasFilter ? (
        <>
          <p className="text-base font-semibold text-runner-dark mb-1">
            No hay carreras con esos filtros.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Quita algún filtro o explora el catálogo completo.
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-runner-dark mb-1">
            Todavía no tenemos carreras para mostrar.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Estamos actualizando el calendario a diario. Vuelve en unos días.
          </p>
        </>
      )}
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-runner-primary hover:underline"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Limpiar todos los filtros
        </button>
      )}
    </div>
  );
}
