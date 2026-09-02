"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";
import { RaceFilters } from "@/components/race-filters";
import { PROVINCE_LIST, RACE_TYPE_LIST, MONTH_LIST } from "@/lib/utils";
import { Search } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Catálogo de carreras</h1>
        <p className="text-gray-600">
          {races.length} {races.length === 1 ? "carrera" : "carreras"} en el Levante
        </p>
      </div>

      <RaceFilters filters={filters} onChange={onFilterChange} />

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando carreras…</div>
      ) : races.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No hay carreras con esos filtros. Prueba a ampliar la búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {races.map((race) => (
            <RaceCard key={race._id} race={race} />
          ))}
        </div>
      )}
    </div>
  );
}
