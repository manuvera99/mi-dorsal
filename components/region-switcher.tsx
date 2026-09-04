"use client";

/**
 * RegionSwitcher — selector manual de comunidad autónoma.
 *
 * UX: dropdown compacto. En el hero de la home aparece como un pill con
 * "📍 [Mi comunidad]" + un chevron. Al hacer click, se abre un menú con
 * las 17 CCAA + Ceuta/Melilla, ordenadas alfabéticamente.
 *
 * Si el usuario NO tiene override manual y NO se detectó por IP,
 * muestra "Elige tu comunidad" (sin emoji de ubicación para no mentir).
 */

import { useState, useRef, useEffect } from "react";
import { MapPin, ChevronDown, Check, RefreshCw, X } from "lucide-react";
import { useUserRegion } from "./use-user-region";
import { cn } from "@/lib/utils";

interface RegionSwitcherProps {
  /** Variante visual. "hero" = pill sobre fondo rojo, "card" = botón estándar */
  variant?: "hero" | "card";
  className?: string;
}

export function RegionSwitcher({ variant = "hero", className }: RegionSwitcherProps) {
  const { community, setCommunity, clearOverride, hasManualOverride, allCommunities, loading } =
    useUserRegion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const isHero = variant === "hero";

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isHero
            ? "bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25 focus-visible:ring-white"
            : "bg-white text-gray-700 border border-gray-300 hover:border-runner-primary hover:text-runner-primary focus-visible:ring-runner-primary"
        )}
        aria-label={`Tu comunidad autónoma: ${community?.name ?? "todavía no seleccionada"}. Click para cambiar.`}
      >
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {loading ? (
          <span>Detectando…</span>
        ) : community ? (
          <span>{community.shortName}</span>
        ) : (
          <span>Elige tu comunidad</span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Comunidades autónomas de España"
          className={cn(
            "absolute z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-lg shadow-xl",
            "bg-white border border-gray-200 text-left",
            // Mobile-friendly: alineado a la izquierda en desktop, a la derecha en móvil si se sale
            "left-0 md:left-0 right-auto",
            "-translate-x-0"
          )}
        >
          <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Tu comunidad
            </p>
            {hasManualOverride && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearOverride();
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-runner-primary"
                aria-label="Borrar selección manual y volver a detección automática"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Auto
              </button>
            )}
          </div>
          <ul className="py-1">
            {allCommunities.map((c) => {
              const selected = community?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setCommunity(c.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-2",
                      "hover:bg-runner-warm focus:bg-runner-warm focus:outline-none",
                      selected && "bg-red-50"
                    )}
                  >
                    <span aria-hidden="true" className="text-base">
                      {c.emoji}
                    </span>
                    <span className={cn("flex-1", selected && "font-semibold text-runner-primary")}>
                      {c.name}
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 text-runner-primary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between bg-gray-50">
            <p className="text-xs text-gray-400">Lo usamos solo para mostrarte carreras cerca.</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Cerrar selector de comunidad"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
