// =============================================================================
// scripts/test-sticker-templates.ts
// =============================================================================
// Test de STICKER_TEMPLATES y applyTemplate: verifica que la plantilla
// tiene coordenadas válidas (0-1) y que aplicarla conserva los campos
// activos del usuario.
// =============================================================================

import {
  STICKER_TEMPLATES,
  applyTemplate,
  type StickerTemplateId,
} from "../lib/sticker-editor/templates";
import type { StickerFieldId } from "../lib/sticker-editor/fields";

let failures = 0;
function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures++;
  }
}

console.log("=== STICKER_TEMPLATES: coordenadas válidas ===");
const templateIds = Object.keys(STICKER_TEMPLATES) as StickerTemplateId[];
check(templateIds.length === 1, `exactamente 1 plantilla (hay ${templateIds.length})`);

for (const id of templateIds) {
  const template = STICKER_TEMPLATES[id];
  check(template.elements.length > 0, `${id}: tiene elementos`);
  for (const el of template.elements) {
    check(el.x >= 0 && el.x <= 1, `${id}/${el.fieldId}: x=${el.x} en rango 0-1`);
    check(el.y >= 0 && el.y <= 1, `${id}/${el.fieldId}: y=${el.y} en rango 0-1`);
    check(el.scale > 0, `${id}/${el.fieldId}: scale=${el.scale} > 0`);
  }
  // time y pace deben estar en toda plantilla predefinida (son el core del sticker)
  const fieldIds = template.elements.map((e) => e.fieldId);
  check(fieldIds.includes("time"), `${id}: incluye 'time'`);
  check(fieldIds.includes("pace"), `${id}: incluye 'pace'`);
}

console.log("\n=== applyTemplate: conserva campos activos ===");
const onlyId = (Object.keys(STICKER_TEMPLATES) as StickerTemplateId[])[0];

// Simula que el usuario activó "dorsal" además de lo default de la plantilla.
const activeFields: StickerFieldId[] = [...STICKER_TEMPLATES[onlyId].elements.map((e) => e.fieldId), "dorsal"];
const result = applyTemplate(onlyId, activeFields);

check(result.elements.some((e) => e.fieldId === "dorsal"), "'dorsal' sigue presente tras aplicar la plantilla");
check(
  result.elements.every((e) => e.visible === activeFields.includes(e.fieldId)),
  "visible=true solo para los fieldId que estaban activos",
);
check(
  result.elements.every((e) => e.x >= 0 && e.x <= 1 && e.y >= 0 && e.y <= 1),
  "todas las posiciones resultantes están en rango 0-1",
);

console.log(`\n${failures === 0 ? "✓ TODOS PASAN" : `✗ ${failures} FALLO(S)`}`);
process.exit(failures === 0 ? 0 : 1);
