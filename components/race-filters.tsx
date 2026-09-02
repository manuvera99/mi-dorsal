"use client";

import { Search } from "lucide-react";
import { PROVINCE_LIST, RACE_TYPE_LIST, MONTH_LIST } from "@/lib/utils";

interface FiltersProps {
  filters: {
    province?: string;
    raceType?: string;
    month?: number;
    search?: string;
  };
  onChange: (filters: any) => void;
}

export function RaceFilters({ filters, onChange }: FiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar carrera…"
          className="input pl-9"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <select
        className="input"
        value={filters.province ?? ""}
        onChange={(e) => onChange({ ...filters, province: e.target.value || undefined })}
      >
        <option value="">Todas las provincias</option>
        {PROVINCE_LIST.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <select
        className="input"
        value={filters.raceType ?? ""}
        onChange={(e) => onChange({ ...filters, raceType: e.target.value || undefined })}
      >
        <option value="">Todos los tipos</option>
        {RACE_TYPE_LIST.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <select
        className="input"
        value={filters.month ?? ""}
        onChange={(e) => onChange({ ...filters, month: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">Todos los meses</option>
        {MONTH_LIST.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
    </div>
  );
}
