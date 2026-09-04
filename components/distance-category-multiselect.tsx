"use client";

/**
 * DistanceCategoryMultiSelect — multi-select de categorías de distancia.
 *
 * 6 categorías estándar de running: 5K, 10K, 15K, Media, Maratón, Ultra.
 * Muestra como pills horizontales, marca visual las seleccionadas.
 * Soporta 0, 1 o N categorías. Estado vacío = "todas las distancias".
 */

import { Check, Ruler } from "lucide-react";
import { DISTANCE_CATEGORY_LIST, type DistanceCategory } from "@/lib/utils";

interface DistanceCategoryMultiSelectProps {
  value: DistanceCategory[];
  onChange: (value: DistanceCategory[]) => void;
}

export function DistanceCategoryMultiSelect({
  value,
  onChange,
}: DistanceCategoryMultiSelectProps) {
  const selected = new Set(value);

  const toggle = (cat: DistanceCategory) => {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange(Array.from(next));
  };

  const clear = () => onChange([]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Ruler className="h-3 w-3" /> Distancia
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-gray-500 hover:text-runner-primary underline"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {DISTANCE_CATEGORY_LIST.map((c) => {
          const isSelected = selected.has(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggle(c.value)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                isSelected
                  ? "bg-runner-primary text-white border-runner-primary"
                  : "bg-white text-gray-700 border-gray-300 hover:border-runner-primary hover:text-runner-primary"
              }`}
            >
              {isSelected && <Check className="h-3 w-3" />}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
