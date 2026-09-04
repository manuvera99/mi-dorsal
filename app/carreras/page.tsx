"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";
import { RaceFilters, useCarrerasFilters, type CarrerasFilters } from "@/components/race-filters";
import { RaceDistanceFilter } from "@/components/race-distance-filter";
import { haversineDistanceKm, type Coords } from "@/lib/geo/distance";
import { RaceMapWrapper } from "@/components/race-map-wrapper";
import { Search, MapPin, List, Map } from "lucide-react";

function MockCarrerasPage() {
  const [filters, setFilters] = useCarrerasFilters();
  const [races, setRaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch cuando cambien los filtros
  useEffect(() => {
    setLoading(true);
    void mockApi.races.list(filters).then((r) => {
      setRaces(r);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return <CarrerasContent races={races} loading={loading} filters={filters} onFilterChange={setFilters} />;
}

function RealCarrerasPage() {
  const [filters, setFilters] = useCarrerasFilters();
  const convexRaces = useQuery(api.races.list, {
    province: filters.province as any,
    raceType: filters.raceType as any,
    month: filters.month,
    search: filters.search,
    organizer: filters.organizer,
    distanceCategories: filters.distanceCategories as any,
  });
  const loading = convexRaces === undefined;
  return <CarrerasContent races={(convexRaces as any) ?? []} loading={loading} filters={filters} onFilterChange={setFilters} />;
}

export default function CarrerasPage() {
  // isMockMode() lee `window` así que solo se puede evaluar en cliente.
  // En SSR siempre devuelve false, lo que haría que Next intentase pre-renderizar
  // RealCarrerasPage con useQuery sin ConvexProvider. Esperamos al primer render
  // en cliente para decidir qué componente montar.
  const [mounted, setMounted] = useState(false);
  const [useMock, setUseMock] = useState(false);
  useEffect(() => {
    setMounted(true);
    setUseMock(isMockMode());
  }, []);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Catálogo de carreras</h1>
        <div className="text-center py-12 text-gray-500">Cargando…</div>
      </div>
    );
  }
  return useMock ? <MockCarrerasPage /> : <RealCarrerasPage />;
}

function CarrerasContent({
  races,
  loading,
  filters,
  onFilterChange,
}: {
  races: any[];
  loading: boolean;
  filters: CarrerasFilters;
  onFilterChange: (f: CarrerasFilters) => void;
}) {
  // Estado del filtro de distancia (geolocalización + slider)
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(200);
  const [filterEnabled, setFilterEnabled] = useState<boolean>(false);
  // Toggle entre lista y mapa
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const handleDistanceChange = useCallback((coords: Coords | null, maxKm: number) => {
    setUserCoords(coords);
    setMaxDistance(maxKm);
    setFilterEnabled(coords !== null);
  }, []);

  // Filtrar carreras por distancia (en cliente, sin tocar el server)
  const filteredRaces = useMemo(() => {
    if (!filterEnabled || !userCoords || maxDistance >= 300) {
      return races;
    }
    return races.filter((r) => {
      if (typeof r.latitude !== "number" || typeof r.longitude !== "number") {
        // Sin coordenadas: la mantenemos visible (no la podemos calcular)
        return true;
      }
      const dist = haversineDistanceKm(userCoords, { latitude: r.latitude, longitude: r.longitude });
      return dist <= maxDistance;
    });
  }, [races, userCoords, maxDistance, filterEnabled]);

  // Calcular distancia para mostrar en cada card
  const raceDistances = useMemo(() => {
    if (!userCoords) return new globalThis.Map<string, number>();
    const map = new globalThis.Map<string, number>();
    for (const r of filteredRaces) {
      if (typeof r.latitude === "number" && typeof r.longitude === "number") {
        const d = haversineDistanceKm(userCoords, { latitude: r.latitude, longitude: r.longitude });
        map.set(r._id, d);
      }
    }
    return map;
  }, [userCoords, filteredRaces]);

  // Stats del filtro
  const totalWithCoords = races.filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number").length;
  const hiddenByDistance = filterEnabled ? races.length - filteredRaces.length : 0;
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.province ? 1 : 0) +
    (filters.raceType ? 1 : 0) +
    (filters.month ? 1 : 0) +
    (filters.organizer ? 1 : 0) +
    (filters.distanceCategories?.length ?? 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Catálogo de carreras</h1>
        <p className="text-gray-600">
          {filterEnabled
            ? `${filteredRaces.length} de ${races.length} carreras dentro de ${maxDistance >= 300 ? "sin límite" : `${maxDistance} km`}`
            : `${races.length} ${races.length === 1 ? "carrera" : "carreras"}`}
          {filterEnabled && hiddenByDistance > 0 && (
            <span className="text-gray-400"> · {hiddenByDistance} ocultas por distancia</span>
          )}
          {activeFilterCount > 0 && (
            <span className="text-gray-400"> · {activeFilterCount} {activeFilterCount === 1 ? "filtro activo" : "filtros activos"}</span>
          )}
        </p>
      </div>

      <RaceDistanceFilter onChange={handleDistanceChange} initialMaxDistance={maxDistance} />

      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <RaceFilters filters={filters} onChange={onFilterChange} />
        </div>
        <div className="flex items-center bg-white border border-gray-300 rounded-md p-0.5 flex-shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded ${
              viewMode === "list"
                ? "bg-runner-primary text-white"
                : "text-gray-600 hover:text-runner-primary"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded ${
              viewMode === "map"
                ? "bg-runner-primary text-white"
                : "text-gray-600 hover:text-runner-primary"
            }`}
          >
            <Map className="h-3.5 w-3.5" /> Mapa
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando carreras…</div>
      ) : filteredRaces.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          {filterEnabled && hiddenByDistance > 0 ? (
            <>
              <p>No hay carreras dentro de tu radio de {maxDistance} km.</p>
              <p className="text-sm mt-2">Prueba a ampliar la distancia o desactivar el filtro de ubicación.</p>
            </>
          ) : activeFilterCount > 0 ? (
            <>
              <p>No hay carreras con esos filtros.</p>
              <p className="text-sm mt-2">Prueba a quitar algún filtro arriba.</p>
            </>
          ) : (
            <p>No hay carreras disponibles.</p>
          )}
        </div>
      ) : viewMode === "map" ? (
        <>
          {filterEnabled && totalWithCoords < races.length && (
            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-md p-2 mb-3 flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>
                {totalWithCoords} de {races.length} carreras tienen coordenadas y se muestran en el mapa.
                Las {races.length - totalWithCoords} sin coordenadas no aparecen aquí (pero sí en la lista).
              </span>
            </div>
          )}
          <RaceMapWrapper
            races={filteredRaces.filter(
              (r) => typeof r.latitude === "number" && typeof r.longitude === "number"
            )}
            userCoords={userCoords}
            maxDistanceKm={maxDistance}
          />
        </>
      ) : (
        <>
          {filterEnabled && totalWithCoords < races.length && (
            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-md p-2 mt-4 flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>
                {totalWithCoords} de {races.length} carreras tienen coordenadas.
                Las que no tienen se muestran siempre (no podemos calcular la distancia).
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filteredRaces.map((race) => (
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
