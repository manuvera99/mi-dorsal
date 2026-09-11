// =============================================================================
// mi-dorsal — StickerCanvas
// =============================================================================
// Lienzo del editor de sticker: 1080x1920 lógico, renderizado a un tamaño
// visual menor en pantalla (CSS transform: scale), pero el DOM interno
// mantiene las dimensiones lógicas para que html-to-image capture a
// resolución completa (ver Task 9, exportStickerToBlob). El checkerboard
// vive en el wrapper exterior (fuera de canvasRef), así que nunca aparece
// en el PNG capturado.
// =============================================================================

"use client";

import { useRef } from "react";
import type { StickerElementLayout } from "./templates";
import type { StickerData, StickerFieldId } from "./fields";
import { usePointerDrag } from "./usePointerDrag";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

const PALETTE = {
  accent: "#16a34a",
  primary: "#dc2626",
  ink: "#1c1917",
  muted: "#78716c",
  prBg: "#dcfce7",
  prText: "#15803d",
  panelBg: "rgba(255, 255, 255, 0.92)",
};

interface StickerCanvasProps {
  elements: StickerElementLayout[];
  data: StickerData;
  selectedFieldId: StickerFieldId | null;
  onSelect: (fieldId: StickerFieldId | null) => void;
  onMove: (fieldId: StickerFieldId, x: number, y: number) => void;
  onResize: (fieldId: StickerFieldId, scale: number) => void;
  /** Tamaño visual en pantalla (px). El lienzo lógico sigue siendo 1080x1920. */
  displayWidth: number;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function StickerCanvas({
  elements,
  data,
  selectedFieldId,
  onSelect,
  onMove,
  onResize,
  displayWidth,
  canvasRef,
}: StickerCanvasProps) {
  const scaleRatio = displayWidth / CANVAS_WIDTH;
  const displayHeight = CANVAS_HEIGHT * scaleRatio;

  return (
    <div
      data-sticker-checkerboard
      style={{
        width: displayWidth,
        height: displayHeight,
        overflow: "hidden",
        position: "relative",
        backgroundImage:
          "repeating-conic-gradient(#e5e5e5 0% 25%, #f5f5f5 0% 50%)",
        backgroundSize: "24px 24px",
        borderRadius: "8px",
      }}
      onClick={() => onSelect(null)}
    >
      <div
        ref={canvasRef}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scaleRatio})`,
          transformOrigin: "top left",
          position: "relative",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {elements
          .filter((el) => el.visible)
          .map((el) => (
            <StickerElementView
              key={el.fieldId}
              element={el}
              data={data}
              isSelected={selectedFieldId === el.fieldId}
              onSelect={() => onSelect(el.fieldId)}
              onMove={(x, y) => onMove(el.fieldId, x, y)}
              onResize={(scale) => onResize(el.fieldId, scale)}
              dragContainerRef={canvasRef}
            />
          ))}

        {/* Logo mi-dorsal — siempre visible, no forma parte de `elements`
            (no se puede ocultar, mover ni redimensionar). Va dentro del
            nodo capturado por html-to-image, así que sí sale en el PNG. */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              backgroundColor: PALETTE.primary,
              borderRadius: "7px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: "white", fontSize: "17px", fontWeight: 700, fontFamily: "JetBrains Mono", lineHeight: 1 }}>
              m
            </div>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "white", letterSpacing: "-0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
            mi-dorsal
          </div>
        </div>
      </div>
    </div>
  );
}

function StickerElementView({
  element,
  data,
  isSelected,
  onSelect,
  onMove,
  onResize,
  dragContainerRef,
}: {
  element: StickerElementLayout;
  data: StickerData;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (scale: number) => void;
  /** El lienzo completo (1080x1920 lógico, escalado visualmente con CSS
   *  transform), NO el propio elemento — el delta de arrastre debe
   *  normalizarse contra el tamaño del lienzo, no contra un elemento que
   *  cambia de tamaño mientras lo redimensionas (eso crearía un bucle de
   *  feedback: el delta cambiaría de escala en cada frame de resize). */
  dragContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // `elementRef` se actualiza en cada render para que los closures de
  // `onDelta` de abajo siempre lean la posición/escala MÁS RECIENTE, no la
  // que había justo antes de empezar el drag. Sin esto, cada pointermove
  // durante un mismo gesto de arrastre calculaba `element.x + delta` sobre
  // el `element` capturado en el render anterior al mousedown — el
  // elemento apenas se movía (o saltaba de forma errática) porque nunca
  // acumulaba el desplazamiento, solo aplicaba el último delta incremental
  // sobre la posición original.
  const elementRef = useRef(element);
  elementRef.current = element;

  const moveDrag = usePointerDrag(dragContainerRef, (deltaX, deltaY) => {
    const current = elementRef.current;
    const nextX = Math.min(1, Math.max(0, current.x + deltaX));
    const nextY = Math.min(1, Math.max(0, current.y + deltaY));
    onMove(nextX, nextY);
  });

  const resizeDrag = usePointerDrag(dragContainerRef, (deltaX) => {
    const current = elementRef.current;
    const nextScale = Math.min(3, Math.max(0.3, current.scale + deltaX * 2));
    onResize(nextScale);
  });

  return (
    <div
      ref={wrapperRef}
      onPointerDown={(e) => {
        onSelect();
        moveDrag.onPointerDown(e);
      }}
      style={{
        position: "absolute",
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${element.scale})`,
        cursor: "move",
        outline: isSelected ? "3px dashed #4ade80" : "none",
        outlineOffset: "4px",
        touchAction: "none",
      }}
    >
      <StickerFieldContent fieldId={element.fieldId} data={data} />
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            resizeDrag.onPointerDown(e);
          }}
          style={{
            position: "absolute",
            right: "-16px",
            bottom: "-16px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#4ade80",
            border: "3px solid white",
            cursor: "nwse-resize",
            touchAction: "none",
          }}
        />
      )}
    </div>
  );
}

/** Renderiza el contenido visual de cada fieldId. Sin lógica de posición
 *  (eso vive en el wrapper) — solo el "cómo se ve" cada dato. */
function StickerFieldContent({
  fieldId,
  data,
}: {
  fieldId: StickerFieldId;
  data: StickerData;
}) {
  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: PALETTE.panelBg,
    borderRadius: "24px",
    padding: "24px 40px",
    whiteSpace: "nowrap",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    color: PALETTE.muted,
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginBottom: "8px",
  };

  switch (fieldId) {
    case "time":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Tu tiempo oficial</div>
          <div style={{ fontSize: "96px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.accent, lineHeight: 1 }}>
            {data.timeFormatted ?? "—"}
          </div>
        </div>
      );
    case "pace":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Pace</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.paceFormatted ?? "—"} /km
          </div>
        </div>
      );
    case "position":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Pos. general</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.positionOverall ?? "—"}
            {data.totalRunners ? ` / ${data.totalRunners}` : ""}
          </div>
        </div>
      );
    case "positionCategory":
      return (
        <div style={panelStyle}>
          <div style={labelStyle}>Pos. categoría</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.positionCategory ?? "—"}
          </div>
        </div>
      );
    case "pr":
      return (
        <div
          style={{
            display: "flex",
            backgroundColor: PALETTE.prBg,
            borderRadius: "999px",
            padding: "12px 28px",
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 700, color: PALETTE.prText, letterSpacing: "0.5px" }}>
            🎉 Nuevo PR
          </div>
        </div>
      );
    case "dorsal":
      return (
        <div style={{ ...panelStyle, backgroundColor: PALETTE.primary }}>
          <div style={{ ...labelStyle, color: "rgba(255,255,255,0.85)" }}>Dorsal</div>
          <div style={{ fontSize: "72px", fontWeight: 700, fontFamily: "JetBrains Mono", color: "white" }}>
            {data.dorsalNumber ?? "—"}
          </div>
        </div>
      );
    case "raceNameDate":
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: PALETTE.ink }}>{data.raceName ?? "—"}</div>
          <div style={{ fontSize: "18px", color: PALETTE.muted, marginTop: "4px" }}>{data.raceDate ?? ""}</div>
        </div>
      );
    case "runnerName":
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: "32px", fontWeight: 700, color: PALETTE.ink }}>{data.runnerName ?? "—"}</div>
        </div>
      );
    case "distance":
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: PALETTE.ink }}>{data.distanceLabel ?? "—"}</div>
        </div>
      );
    case "routeMap":
      return (
        <svg width="300" height="300" viewBox="0 0 300 300">
          <path
            d={data.routeSvgPath ?? ""}
            fill="none"
            stroke={PALETTE.accent}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
