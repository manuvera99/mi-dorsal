"use client";

/**
 * OrganizerCombobox — desplegable con búsqueda integrada.
 *
 * Carga la lista de organizadoras con conteo desde la query
 * `api.races.listOrganizers` (o `mockApi.races.listOrganizers` en mock mode).
 * Filtra en cliente conforme el usuario escribe.
 * Muestra conteo al lado del nombre para guiar la elección.
 *
 * Accesibilidad: combobox ARIA-compliant con soporte de teclado básico.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { ChevronDown, X, Search, Building2 } from "lucide-react";

interface OrganizerOption {
  name: string;
  count: number;
}

interface OrganizerComboboxProps {
  value: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}

export function OrganizerCombobox({
  value,
  onChange,
  placeholder = "Todas las organizadoras",
}: OrganizerComboboxProps) {
  const useMock = isMockMode();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar lista. En mock mode se carga lazy al primer open; en real mode
  // se carga siempre (Convex cachea).
  const convexOrganizers = useQuery(api.races.listOrganizers);
  const [mockOrganizers, setMockOrganizers] = useState<OrganizerOption[] | null>(null);
  useEffect(() => {
    if (useMock && open && mockOrganizers === null) {
      void mockApi.races.listOrganizers().then((arr: OrganizerOption[]) => {
        setMockOrganizers(arr);
      });
    }
  }, [useMock, open, mockOrganizers]);

  const organizers: OrganizerOption[] = useMemo(() => {
    if (useMock) return mockOrganizers ?? [];
    return (convexOrganizers as OrganizerOption[] | undefined) ?? [];
  }, [useMock, mockOrganizers, convexOrganizers]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return organizers;
    return organizers.filter((o) => o.name.toLowerCase().includes(s));
  }, [organizers, search]);

  // Click outside cierra
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      // pequeño delay para que el input se monte
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (name: string) => {
    onChange(name === value ? undefined : name);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  const totalCount = organizers.reduce((acc, o) => acc + o.count, 0);
  const currentOption = organizers.find((o) => o.name === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="input flex items-center justify-between gap-1 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {currentOption ? (
            <span className="truncate">
              {currentOption.name}
              <span className="text-gray-400 text-xs ml-1">({currentOption.count})</span>
            </span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleClear();
                }
              }}
              className="p-0.5 rounded hover:bg-gray-200 cursor-pointer"
              title="Quitar filtro"
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 flex flex-col">
          {/* Buscador interno */}
          <div className="p-2 border-b border-gray-200 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar entre ${organizers.length} organizadoras…`}
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-runner-primary"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filtered.length > 0) {
                    handleSelect(filtered[0].name);
                  }
                }}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {organizers.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">Cargando organizadoras…</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">
                No hay organizadoras que coincidan con "{search}".
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => handleSelect(o.name)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-blue-50 ${
                    o.name === value ? "bg-blue-100 font-semibold" : ""
                  }`}
                >
                  <span className="truncate">{o.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {o.count} {o.count === 1 ? "carrera" : "carreras"}
                  </span>
                </button>
              ))
            )}
          </div>

          {value && (
            <div className="border-t border-gray-200 p-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-xs text-gray-600 hover:text-runner-primary py-1"
              >
                ✕ Quitar filtro de organizadora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
