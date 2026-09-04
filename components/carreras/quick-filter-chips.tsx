"use client";

/**
 * QuickFilterChips — pills horizontales para filtrar con 1 click.
 *
 * Dos grupos: distancias + meses. Cada pill es un toggle:
 *  - Click: aplica el filtro.
 *  - Click en la activa: la quita.
 *
 * En móvil los chips hacen scroll horizontal (overflow-x-auto).
 * Sticky bajo el buscador para mantener el contexto durante scroll.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DISTANCE_CATEGORY_LIST,
  MONTH_LIST,
  type DistanceCategory,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

interface QuickFilterChipsProps {
  selectedDistance: DistanceCategory | null;
  selectedMonth: number | null;
  onSelectDistance: (d: DistanceCategory | null) => void;
  onSelectMonth: (m: number | null) => void;
}

export function QuickFilterChips({
  selectedDistance,
  selectedMonth,
  onSelectDistance,
  onSelectMonth,
}: QuickFilterChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scrollBy(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      {/* Distancias */}
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth -mx-4 px-4 md:mx-0 md:px-0"
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider self-center flex-shrink-0 mr-1">
            Distancia
          </span>
          {DISTANCE_CATEGORY_LIST.map((d) => {
            const active = selectedDistance === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => onSelectDistance(active ? null : d.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runner-primary focus-visible:ring-offset-1",
                  active
                    ? "bg-runner-primary text-white border border-runner-primary"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-runner-primary hover:text-runner-primary"
                )}
                aria-pressed={active}
              >
                {active && <span aria-hidden="true">✓</span>}
                {d.label}
              </button>
            );
          })}
        </div>
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy("left")}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 h-7 w-7 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:border-runner-primary"
            aria-label="Scroll izquierda"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy("right")}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 h-7 w-7 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:border-runner-primary"
            aria-label="Scroll derecha"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Meses */}
      <div className="relative group">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth -mx-4 px-4 md:mx-0 md:px-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider self-center flex-shrink-0 mr-1">
            Mes
          </span>
          {MONTH_LIST.map((m, i) => {
            const monthNum = i + 1;
            const active = selectedMonth === monthNum;
            // Meses pasados quedan dim
            const now = new Date();
            const isPast = monthNum < now.getMonth() + 1;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSelectMonth(active ? null : monthNum)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runner-primary focus-visible:ring-offset-1",
                  active
                    ? "bg-runner-primary text-white border border-runner-primary"
                    : isPast
                    ? "bg-white text-gray-400 border border-gray-200 hover:border-runner-primary hover:text-runner-primary"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-runner-primary hover:text-runner-primary"
                )}
                aria-pressed={active}
              >
                {active && <span aria-hidden="true">✓</span>}
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
