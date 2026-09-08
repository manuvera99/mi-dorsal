"use client";

// =============================================================================
// mi-dorsal — Combobox de búsqueda de club de atletismo
// =============================================================================
// Con 3.812 clubes en la lista, un <select> plano es injusable. Este
// combobox replica el patrón estándar: input arriba + lista filtrada abajo.
//
// Funcionalidad:
//   - Filtrado en tiempo real por nombre y/o CCAA (case-insensitive).
//   - Top 50 resultados. Si hay más, indicamos "y N más" al final.
//   - Botón "Otro (especificar a mano)" → input libre (clubs no federados).
//   - Botón "No encuentro mi club" → dialog de report para el admin.
//   - Muestra el club seleccionado como pill con X para limpiar.
//
// Datos: `lib/data/clubs.json` (cacheados en build, sin API en runtime).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import clubsData from "@/lib/data/clubs.json";
import { Search, X, ChevronDown } from "lucide-react";
import { ReportMissingClubDialog } from "./report-missing-club-dialog";

type ClubEntry = { name: string; ccaa: string };
type ClubsPayload = {
  source: string;
  fetchedAt: string;
  total: number;
  clubs: ClubEntry[];
};

const data = clubsData as ClubsPayload;

// Top N resultados cuando no hay query. Mantenemos el orden alfabético
// que ya viene en el JSON.
const MAX_VISIBLE_RESULTS = 50;

export interface ClubSelectProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Máximo de caracteres admitidos en el input de "Otro". Default 80. */
  maxLength?: number;
}

// Normaliza para búsqueda: minúsculas, sin tildes. Usado para match
// case- y accent-insensitive (el usuario puede teclear "alicante" y
// matchear "Alicante").
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ClubSelect({
  value,
  onChange,
  disabled,
  maxLength = 80,
}: ClubSelectProps) {
  // Estados: input del buscador, si el usuario eligió "Otro", texto de "Otro",
  // y si el dialog de report está abierto.
  const [query, setQuery] = useState("");
  const [otherText, setOtherText] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ¿El value actual es un club exacto de la lista, "Otro", o vacío?
  const exactMatch = useMemo(
    () => data.clubs.find((c) => c.name === value) ?? null,
    [value],
  );
  const isOther = !exactMatch && value !== "" && value != null;

  // Sincroniza el estado local de "Otro" cuando el padre cambia el value
  // externamente (ej. al abrir el modal con un club ya guardado).
  useEffect(() => {
    if (isOther) {
      setShowOther(true);
      setOtherText(value);
    } else {
      setShowOther(false);
      setOtherText("");
    }
    // Resetea query al cargar: el usuario verá el club seleccionado (pill)
    // y, si quiere cambiar, escribirá en el buscador.
    setQuery("");
  }, [value, isOther]);

  // Resultados del filtrado. Si no hay query, top 50 alfabético. Si hay,
  // busca por nombre Y por CCAA (substring, accent-insensitive).
  const results = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (q === "") {
      return data.clubs.slice(0, MAX_VISIBLE_RESULTS);
    }
    const filtered = data.clubs.filter((c) => {
      const name = normalizeForSearch(c.name);
      const ccaa = normalizeForSearch(c.ccaa);
      return name.includes(q) || ccaa.includes(q);
    });
    return filtered.slice(0, MAX_VISIBLE_RESULTS);
  }, [query]);

  const hasMoreResults = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (q === "") return data.clubs.length > MAX_VISIBLE_RESULTS;
    const total = data.clubs.filter((c) => {
      const name = normalizeForSearch(c.name);
      const ccaa = normalizeForSearch(c.ccaa);
      return name.includes(q) || ccaa.includes(q);
    }).length;
    return total > MAX_VISIBLE_RESULTS;
  }, [query]);

  // Cierra el dropdown al hacer click fuera.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectClub = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setQuery("");
  };

  const handleClearSelection = () => {
    onChange("");
    setShowOther(false);
    setOtherText("");
    setQuery("");
    // Reabrir el buscador para que el usuario pueda elegir otro.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleOtherToggle = () => {
    if (showOther) {
      // Ya está en modo "Otro": colapsar.
      setShowOther(false);
      onChange(otherText);
    } else {
      // Activar modo "Otro".
      setShowOther(true);
      onChange(otherText || "");
      setIsOpen(false);
    }
  };

  const handleOtherTextChange = (next: string) => {
    const trimmed = next.slice(0, maxLength);
    setOtherText(trimmed);
    onChange(trimmed);
  };

  // Render del pill con el club actualmente seleccionado (o el modo "Otro").
  const renderSelectedPill = () => {
    if (value === "") {
      return (
        <p className="text-xs text-gray-400 italic mt-1">
          Sin club
        </p>
      );
    }
    if (exactMatch) {
      return (
        <p className="text-xs text-gray-600 mt-1">
          <span className="font-medium">{exactMatch.name}</span>
          <span className="text-gray-400"> · {exactMatch.ccaa}</span>
        </p>
      );
    }
    if (isOther) {
      return (
        <p className="text-xs text-gray-600 mt-1">
          <span className="text-gray-400">Otro:</span>{" "}
          <span className="font-medium">{value}</span>
        </p>
      );
    }
    return null;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Pill con la selección actual + X para limpiar */}
      {value !== "" && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 bg-runner-warm border border-stone-200 rounded-md px-2 py-1 text-sm">
            <span className="font-medium truncate max-w-[260px]">{value}</span>
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
              aria-label="Quitar selección"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Input de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={value ? "Cambiar club… busca por nombre o CCAA" : "Busca tu club por nombre o CCAA…"}
          disabled={disabled}
          className="w-full border border-gray-300 rounded-md pl-9 pr-9 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Buscar club"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 disabled:opacity-60"
          aria-label="Abrir lista"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Lista de resultados (dropdown) */}
      {isOpen && (
        <div
          className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto"
          role="listbox"
        >
          {results.length > 0 ? (
            <>
              {results.map((c) => (
                <button
                  type="button"
                  key={`${c.ccaa}|${c.name}`}
                  onClick={() => selectClub(c.name)}
                  className="w-full text-left px-3 py-2 hover:bg-runner-warm focus:bg-runner-warm focus:outline-none"
                  role="option"
                  aria-selected={value === c.name}
                >
                  <div className="text-sm font-medium text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.ccaa}</div>
                </button>
              ))}
              {hasMoreResults && (
                <p className="px-3 py-2 text-xs text-gray-500 italic border-t border-gray-100">
                  …refina la búsqueda para ver más resultados
                </p>
              )}
            </>
          ) : (
            <div className="px-3 py-4 text-center">
              <p className="text-sm text-gray-600">
                No hemos encontrado <span className="font-medium">"{query}"</span> en la lista RFEA.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowReportDialog(true);
                  setIsOpen(false);
                }}
                className="mt-2 text-xs text-runner-primary hover:underline"
              >
                Avisa al admin para que lo añadamos →
              </button>
            </div>
          )}

          {/* Separador + acciones auxiliares */}
          <div className="border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={handleOtherToggle}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white"
            >
              {showOther ? "— Quitar 'Otro (especificar)' —" : "+ Otro (especificar a mano)"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReportDialog(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-runner-primary hover:bg-white"
            >
              No encuentro mi club, avisa al admin →
            </button>
          </div>
        </div>
      )}

      {/* Input libre de "Otro" */}
      {showOther && (
        <div className="mt-2">
          <input
            type="text"
            value={otherText}
            onChange={(e) => handleOtherTextChange(e.target.value)}
            maxLength={maxLength}
            placeholder="Nombre de tu club"
            disabled={disabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Tu club no está federado en la RFEA (o es un club popular como Bull Runners).
          </p>
        </div>
      )}

      {/* Subtexto con la selección actual */}
      {renderSelectedPill()}

      {/* Dialog de reportar club no encontrado */}
      {showReportDialog && (
        <ReportMissingClubDialog
          initialQuery={query}
          onClose={() => setShowReportDialog(false)}
        />
      )}
    </div>
  );
}
