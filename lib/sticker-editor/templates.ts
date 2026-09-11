// =============================================================================
// mi-dorsal — Plantillas predefinidas del editor de sticker
// =============================================================================
// 3 layouts de partida sobre el lienzo lógico 1080x1920 (coordenadas
// normalizadas 0-1). El usuario elige una al abrir el editor; puede
// cambiar de plantilla más adelante sin perder qué campos tenía activos
// (ver applyTemplate). Reutilizan la paleta de lib/share-card/render.tsx
// a nivel visual (eso vive en StickerCanvas.tsx, no aquí — este módulo
// solo define layout, no estilo).
// =============================================================================

import { FIELD_CATALOG, type StickerFieldId } from "./fields";

export type StickerTemplateId = "classic" | "minimal" | "bold";

export interface StickerElementLayout {
  fieldId: StickerFieldId;
  visible: boolean;
  x: number;
  y: number;
  scale: number;
}

export interface StickerTemplate {
  id: StickerTemplateId;
  label: string;
  elements: StickerElementLayout[];
}

// "Classic": todo centrado verticalmente, apilado — mismo espíritu que
// el story-sticker.tsx fijo actual (pr badge, tiempo hero, pace+posición
// en fila).
const CLASSIC: StickerTemplate = {
  id: "classic",
  label: "Clásica",
  elements: [
    { fieldId: "pr", visible: true, x: 0.5, y: 0.32, scale: 1 },
    { fieldId: "time", visible: true, x: 0.5, y: 0.42, scale: 1 },
    { fieldId: "pace", visible: true, x: 0.35, y: 0.52, scale: 1 },
    { fieldId: "position", visible: true, x: 0.65, y: 0.52, scale: 1 },
  ],
};

// "Minimal": solo el tiempo, grande, en el tercio superior, sin badges.
const MINIMAL: StickerTemplate = {
  id: "minimal",
  label: "Minimal",
  elements: [
    { fieldId: "time", visible: true, x: 0.5, y: 0.25, scale: 1.15 },
    { fieldId: "pace", visible: true, x: 0.5, y: 0.35, scale: 0.85 },
  ],
};

// "Bold": tiempo arriba, dorsal grande abajo, ruta como fondo decorativo
// en el centro (si hay dato).
const BOLD: StickerTemplate = {
  id: "bold",
  label: "Bold",
  elements: [
    { fieldId: "time", visible: true, x: 0.5, y: 0.2, scale: 1.1 },
    { fieldId: "pace", visible: true, x: 0.5, y: 0.3, scale: 0.8 },
    { fieldId: "routeMap", visible: true, x: 0.5, y: 0.5, scale: 1 },
    { fieldId: "dorsal", visible: true, x: 0.5, y: 0.78, scale: 1 },
    { fieldId: "position", visible: true, x: 0.5, y: 0.88, scale: 0.9 },
  ],
};

export const STICKER_TEMPLATES: Record<StickerTemplateId, StickerTemplate> = {
  classic: CLASSIC,
  minimal: MINIMAL,
  bold: BOLD,
};

/**
 * Posición/escala default de un fieldId cuando el usuario lo añade con
 * "+ Añadir dato" y esa plantilla no lo incluye por defecto. `offsetIndex`
 * escalona cada campo nuevo añadido en la misma tanda para que no se
 * amonate exactamente en el mismo punto (0.5, 0.65) — cada uno cae un
 * poco más abajo y alternando left/right, y el usuario sigue pudiendo
 * arrastrarlo desde ahí.
 */
function defaultPositionFor(
  fieldId: StickerFieldId,
  offsetIndex: number = 0,
): { x: number; y: number; scale: number } {
  const row = Math.floor(offsetIndex / 2);
  const col = offsetIndex % 2;
  return {
    x: col === 0 ? 0.35 : 0.65,
    y: Math.min(0.9, 0.65 + row * 0.08),
    scale: FIELD_CATALOG[fieldId].defaultScale,
  };
}

/**
 * Cambia a la plantilla `templateId` conservando cuáles de los
 * `activeFieldIds` (fieldId que el usuario tenía visibles antes del
 * cambio) siguen visibles. Un campo activo que la nueva plantilla no
 * define de forma nativa se añade con una posición default centrada.
 * Un campo que la plantilla SÍ define pero no estaba en `activeFieldIds`
 * queda con visible=false (el usuario tendría que reactivarlo).
 */
export function applyTemplate(
  templateId: StickerTemplateId,
  activeFieldIds: StickerFieldId[],
): StickerTemplate {
  const base = STICKER_TEMPLATES[templateId];
  const baseFieldIds = new Set(base.elements.map((e) => e.fieldId));

  const elements: StickerElementLayout[] = base.elements.map((el) => ({
    ...el,
    visible: activeFieldIds.includes(el.fieldId),
  }));

  let addedCount = 0;
  for (const fieldId of activeFieldIds) {
    if (!baseFieldIds.has(fieldId)) {
      elements.push({
        fieldId,
        visible: true,
        ...defaultPositionFor(fieldId, addedCount),
      });
      addedCount++;
    }
  }

  return { id: templateId, label: base.label, elements };
}
