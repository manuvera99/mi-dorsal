"use client";

/**
 * RaceFilters — barra de filtros para /carreras.
 *
 * Filtros soportados:
 *  - search           : texto libre (nombre + localidad + organizadora)
 *  - province         : desplegable de 50+ provincias
 *  - raceType         : road / trail / mixed / obstacle
 *  - month            : 1-12
 *  - organizer        : combobox con búsqueda (este archivo)
 *  - distanceCategories: multi-select de 5K/10K/15K/Media/Maratón/Ultra
 *
 * Estado persistido en sessionStorage (clave STORAGE_KEY).
 */

import { useEffect, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { PROVINCE_LIST, RACE_TYPE_LIST, MONTH_LIST, type DistanceCategory } from "@/lib/utils";
import { OrganizerCombobox } from "./organizer-combobox";
import { DistanceCategoryMultiSelect } from "./distance-category-multiselect";

const STORAGE_KEY = "mi-dorsal.carrerasFilters";

export interface CarrerasFilters {
  search?: string;
  province?: string;
  raceType?: string;
  month?: number;
  organizer?: string;
  distanceCategories?: DistanceCategory[];
}

interface FiltersProps {
  filters: CarrerasFilters;
  onChange: (filters: CarrerasFilters) => void;
}

export function RaceFilters({ filters, onChange }: FiltersProps) {
  const update = useCallback(
    (patch: Partial<CarrerasFilters>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange],
  );

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.province ? 1 : 0) +
    (filters.raceType ? 1 : 0) +
    (filters.month ? 1 : 0) +
    (filters.organizer ? 1 : 0) +
    (filters.distanceCategories?.length ?? 0);

  return (
    <div className="space-y-3 mb-6">
      {/* Fila 1: buscador + provincia + tipo + mes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar carrera…"
            className="input pl-9"
            value={filters.search ?? ""}
            onChange={(e) => update({ search: e.target.value || undefined })}
          />
        </div>

        <select
          className="input"
          value={filters.province ?? ""}
          onChange={(e) => update({ province: e.target.value || undefined })}
        >
          <option value="">Todas las provincias</option>
          {PROVINCE_LIST.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <select
          className="input"
          value={filters.raceType ?? ""}
          onChange={(e) => update({ raceType: e.target.value || undefined })}
        >
          <option value="">Todos los tipos</option>
          {RACE_TYPE_LIST.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select
          className="input"
          value={filters.month ?? ""}
          onChange={(e) => update({ month: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Todos los meses</option>
          {MONTH_LIST.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      {/* Fila 2: organizadora (combobox) + distancia (multi-select) */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-3">
        <OrganizerCombobox
          value={filters.organizer ?? ""}
          onChange={(v) => update({ organizer: v })}
        />
        <div>
          <DistanceCategoryMultiSelect
            value={filters.distanceCategories ?? []}
            onChange={(v) => update({ distanceCategories: v.length > 0 ? v : undefined })}
          />
        </div>
      </div>

      {/* Chips de filtros activos + botón limpiar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Filtros activos:</span>
          {filters.search && (
            <Chip onClear={() => update({ search: undefined })}>
              "{filters.search}"
            </Chip>
          )}
          {filters.province && (
            <Chip onClear={() => update({ province: undefined })}>
              {PROVINCE_LIST.find((p) => p.value === filters.province)?.label ?? filters.province}
            </Chip>
          )}
          {filters.raceType && (
            <Chip onClear={() => update({ raceType: undefined })}>
              {RACE_TYPE_LIST.find((t) => t.value === filters.raceType)?.label ?? filters.raceType}
            </Chip>
          )}
          {filters.month && (
            <Chip onClear={() => update({ month: undefined })}>
              {MONTH_LIST[filters.month - 1]}
            </Chip>
          )}
          {filters.organizer && (
            <Chip onClear={() => update({ organizer: undefined })}>
              🏢 {filters.organizer}
            </Chip>
          )}
          {filters.distanceCategories?.map((c) => (
            <Chip
              key={c}
              onClear={() => {
                const next = (filters.distanceCategories ?? []).filter((x) => x !== c);
                update({ distanceCategories: next.length > 0 ? next : undefined });
              }}
            >
              {c}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-xs text-red-600 hover:text-red-700 underline ml-auto"
          >
            Limpiar todos
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-runner-primary/10 text-runner-primary border border-runner-primary/30">
      {children}
      <button
        type="button"
        onClick={onClear}
        className="hover:bg-runner-primary/20 rounded-full p-0.5"
        title="Quitar"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * Hook helper para persistir los filtros en sessionStorage.
 * Usar así:
 *   const [filters, setFilters] = useCarrerasFilters();
 */
export function useCarrerasFilters(): [CarrerasFilters, (f: CarrerasFilters) => void] {
  const [filters, setFilters] = useState<CarrerasFilters>({});

  // Cargar de sessionStorage al montar
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CarrerasFilters;
        setFilters(parsed);
      }
    } catch {}
  }, []);

  // Persistir cambios
  useEffect(() => {
    try {
      if (Object.keys(filters).length === 0) {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      }
    } catch {}
  }, [filters]);

  return [filters, setFilters];
}
