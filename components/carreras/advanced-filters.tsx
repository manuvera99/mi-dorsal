"use client";

/**
 * AdvancedFilters — filtros avanzados plegables.
 *
 * Por defecto, solo se ven los chips rápidos (distancia + mes).
 * Este acordeón se abre al hacer click en "Más filtros" y contiene
 * los filtros secundarios: provincia, tipo, organizadora.
 *
 * El mapa interactivo y el slider de distancia GPS se mantienen
 * fuera, en su propio componente (`RaceDistanceFilter`).
 */

import { useState } from "react";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { PROVINCE_LIST, RACE_TYPE_LIST, type DistanceCategory } from "@/lib/utils";
import { OrganizerCombobox } from "@/components/organizer-combobox";
import { DistanceCategoryMultiSelect } from "@/components/distance-category-multiselect";
import { cn } from "@/lib/utils";

interface AdvancedFiltersProps {
  filters: {
    province?: string;
    raceType?: string;
    organizer?: string;
    distanceCategories?: DistanceCategory[];
  };
  onChange: (patch: {
    province?: string;
    raceType?: string;
    organizer?: string;
    distanceCategories?: DistanceCategory[];
  }) => void;
}

export function AdvancedFilters({ filters, onChange }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  // Cuántos filtros activos hay dentro
  const activeSecondaryCount =
    (filters.province ? 1 : 0) +
    (filters.raceType ? 1 : 0) +
    (filters.organizer ? 1 : 0) +
    (filters.distanceCategories?.length ?? 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="advanced-filters-panel"
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3 text-left",
          "hover:bg-runner-warm/50 focus-visible:bg-runner-warm/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-runner-primary",
          "transition-colors rounded-2xl"
        )}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-runner-primary" aria-hidden="true" />
          <span className="font-semibold text-sm text-runner-dark">Más filtros</span>
          {activeSecondaryCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-bold rounded-full bg-runner-primary text-white">
              {activeSecondaryCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-gray-500 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="advanced-filters-panel"
          className="border-t border-gray-200 p-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="province-select" className="label block mb-1.5">
                Provincia
              </label>
              <select
                id="province-select"
                className="input"
                value={filters.province ?? ""}
                onChange={(e) => onChange({ province: e.target.value || undefined })}
              >
                <option value="">Todas las provincias</option>
                {PROVINCE_LIST.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="racetype-select" className="label block mb-1.5">
                Tipo de carrera
              </label>
              <select
                id="racetype-select"
                className="input"
                value={filters.raceType ?? ""}
                onChange={(e) => onChange({ raceType: e.target.value || undefined })}
              >
                <option value="">Todos los tipos</option>
                {RACE_TYPE_LIST.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="organizer-input" className="label block mb-1.5">
              Organizadora
            </label>
            <OrganizerCombobox
              value={filters.organizer ?? ""}
              onChange={(v) => onChange({ organizer: v })}
            />
          </div>

          <div>
            <label className="label block mb-1.5">Distancia (múltiple)</label>
            <DistanceCategoryMultiSelect
              value={filters.distanceCategories ?? []}
              onChange={(v) =>
                onChange({ distanceCategories: v.length > 0 ? v : undefined })
              }
            />
          </div>

          {(filters.province || filters.raceType || filters.organizer || filters.distanceCategories?.length) && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  province: undefined,
                  raceType: undefined,
                  organizer: undefined,
                  distanceCategories: undefined,
                })
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Limpiar filtros secundarios
            </button>
          )}
        </div>
      )}
    </div>
  );
}
