// =============================================================================
// mi-dorsal — TemplatePanel
// =============================================================================
// Lista de plantillas seleccionables (predefinidas + "Mi plantilla" si el
// usuario tiene una guardada) y el botón "Guardar como mi plantilla".
// Componente de presentación puro — el layout que lo envuelve (columna
// fija en desktop, bottom sheet en móvil) decide el contenedor.
// =============================================================================

"use client";

import { STICKER_TEMPLATES, type StickerTemplateId } from "./templates";
import { Sparkles, Save } from "lucide-react";

interface TemplatePanelProps {
  activeTemplateId: StickerTemplateId;
  hasCustomTemplate: boolean;
  onSelectTemplate: (id: StickerTemplateId) => void;
  onSelectCustomTemplate: () => void;
  onSaveCustomTemplate: () => void;
  isSaving: boolean;
}

export function TemplatePanel({
  activeTemplateId,
  hasCustomTemplate,
  onSelectTemplate,
  onSelectCustomTemplate,
  onSaveCustomTemplate,
  isSaving,
}: TemplatePanelProps) {
  const predefinedIds = Object.keys(STICKER_TEMPLATES) as StickerTemplateId[];

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
        Plantillas
      </div>
      {predefinedIds.map((id) => (
        <button
          key={id}
          onClick={() => onSelectTemplate(id)}
          className={`text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            activeTemplateId === id
              ? "border-runner-primary bg-red-50 text-runner-primary"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
        >
          {STICKER_TEMPLATES[id].label}
        </button>
      ))}

      <button
        onClick={onSelectCustomTemplate}
        disabled={!hasCustomTemplate}
        className={`text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
          !hasCustomTemplate
            ? "border-dashed border-stone-300 text-stone-400 cursor-not-allowed"
            : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Mi plantilla
      </button>

      <button
        onClick={onSaveCustomTemplate}
        disabled={isSaving}
        className="btn-secondary mt-2 flex items-center gap-1.5 justify-center text-sm disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "Guardando..." : "Guardar como mi plantilla"}
      </button>
    </div>
  );
}
