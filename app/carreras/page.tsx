"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";
import { RaceFilters } from "@/components/race-filters";
import { RaceDistanceFilter } from "@/components/race-distance-filter";
import { PROVINCE_LIST, RACE_TYPE_LIST, MONTH_LIST } from "@/lib/utils";
import { Search, MapPin } from "lucide-react";
import { haversineDistanceKm, type Coords } from "@/lib/geo/distance";

function MockCarrerasPage() {
  const [filters, setFilters] = useState<any>({});
  const [races, setRaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    mockApi.races.list(filters).then((r) => {
      setRaces(r);
      setLoading(false);
    });
  }, [JSON.stringify(filters)]);

  return <CarrerasContent races={races} loading={loading} filters={filters} onFilterChange={setFilters} />;
}

function RealCarrerasPage() {
  const [filters, setFilters] = useState<any>({});
  const convexRaces = useQuery(api.races.list, {
    province: filters.province as any,
    raceType: filters.raceType as any,
    month: filters.month,
    search: filters.search,
  });
  const loading = convexRaces === undefined;
  return <CarrerasContent races={(convexRaces as any) ?? []} loading={loading} filters={filters} onFilterChange={setFilters} />;
}

export default function CarrerasPage() {
  const useMock = isMockMode();
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
  filters: any;
  onFilterChange: (f: any) => void;
}) {
  // Estado del filtro de distancia (geolocalización + slider)
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(200);
  const [filterEnabled, setFilterEnabled] = useState<boolean>(false);

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
    if (!userCoords) return new Map<string, number>();
    const map = new Map<string, number>();
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Catálogo de carreras</h1>
        <p className="text-gray-600">
          {filterEnabled
            ? `${filteredRaces.length} de ${races.length} carreras dentro de ${maxDistance >= 300 ? "sin límite" : `${maxDistance} km`}`
            : `${races.length} ${races.length === 1 ? "carrera" : "carreras"} en el Levante`}
          {filterEnabled && hiddenByDistance > 0 && (
            <span className="text-gray-400"> · {hiddenByDistance} ocultas por distancia</span>
          )}
        </p>
      </div>

      <RaceDistanceFilter onChange={handleDistanceChange} initialMaxDistance={maxDistance} />

      <RaceFilters filters={filters} onChange={onFilterChange} />

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
          ) : (
            <p>No hay carreras con esos filtros. Prueba a ampliar la búsqueda.</p>
          )}
        </div>
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
