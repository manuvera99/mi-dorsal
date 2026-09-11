// =============================================================================
// mi-dorsal — PropertiesPanel
// =============================================================================
// Dos secciones SIEMPRE visibles, no mutuamente excluyentes:
//   - Propiedades del elemento seleccionado (si hay uno): toggle "Mostrar",
//     slider de tamaño.
//   - Lista de campos disponibles NO visibles todavía, con botón "+ Añadir"
//     por cada uno (spec: "Sin datos para un campo" — `availableFieldIds`
//     ya viene filtrado por getAvailableFields, así que este componente no
//     decide disponibilidad, solo visibilidad actual). Se muestra siempre,
//     con o sin selección, para que el usuario pueda seguir añadiendo
//     datos sin tener que deseleccionar primero.
// =============================================================================

"use client";

import { FIELD_CATALOG, type StickerFieldId } from "./fields";
import type { StickerElementLayout } from "./templates";
import { Eye, EyeOff, Plus } from "lucide-react";

interface PropertiesPanelProps {
  selectedElement: StickerElementLayout | null;
  availableFieldIds: StickerFieldId[];
  activeFieldIds: StickerFieldId[];
  onToggleVisible: (fieldId: StickerFieldId) => void;
  onScaleChange: (fieldId: StickerFieldId, scale: number) => void;
  onAddField: (fieldId: StickerFieldId) => void;
}

export function PropertiesPanel({
  selectedElement,
  availableFieldIds,
  activeFieldIds,
  onToggleVisible,
  onScaleChange,
  onAddField,
}: PropertiesPanelProps) {
  const notYetVisible = availableFieldIds.filter((id) => !activeFieldIds.includes(id));

  return (
    <div className="flex flex-col gap-4">
      {selectedElement && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {FIELD_CATALOG[selectedElement.fieldId].label}
          </div>
          <button
            onClick={() => onToggleVisible(selectedElement.fieldId)}
            className="btn-secondary flex items-center gap-1.5 justify-center text-sm"
          >
            {selectedElement.visible ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Visible
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Oculto
              </>
            )}
          </button>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">
              Tamaño
            </label>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.05}
              value={selectedElement.scale}
              onChange={(e) => onScaleChange(selectedElement.fieldId, Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {selectedElement && <div className="border-t border-stone-200" />}

      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
          Añadir dato
        </div>
        {notYetVisible.length === 0 ? (
          <p className="text-xs text-stone-400">Todos los datos disponibles ya están en el lienzo.</p>
        ) : (
          notYetVisible.map((fieldId) => (
            <button
              key={fieldId}
              onClick={() => onAddField(fieldId)}
              className="text-left px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 hover:bg-stone-50 flex items-center justify-between"
            >
              {FIELD_CATALOG[fieldId].label}
              <Plus className="h-3.5 w-3.5 text-stone-400" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
