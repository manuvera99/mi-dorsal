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

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { StickerElementLayout } from "./templates";
import type { StickerData, StickerFieldId } from "./fields";
import { usePointerDrag } from "./usePointerDrag";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

// Distancia (normalizada 0-1) dentro de la cual un elemento se "engancha"
// al centro horizontal/vertical del lienzo al arrastrarlo. 0.02 ≈ 22px
// lógicos — suficientemente permisivo para atrapar el gesto sin que el
// usuario tenga que ser milimétrico.
const CENTER_SNAP_THRESHOLD = 0.02;

// Margen mínimo (en px lógicos) entre el borde inferior del último
// elemento visible y el logo, y alto aproximado reservado para el logo
// (icono + wordmark), usados para calcular dónde centrarlo en el hueco
// restante del lienzo.
const LOGO_MIN_MARGIN_PX = 36;
const LOGO_HEIGHT_PX = 56;
const LOGO_BOTTOM_PADDING_PX = 24;
// Fracción de fallback si todavía no se ha medido ningún elemento visible
// (primer render) o no hay ninguno visible.
const DEFAULT_CONTENT_BOTTOM_FRACTION = 0.55;

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

  // Líneas guía de centrado, activas mientras se arrastra un elemento que
  // cae dentro del umbral de "engancharse" al centro horizontal/vertical
  // del lienzo. `null` = línea no visible en ese eje.
  const [snapLines, setSnapLines] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  // Bottom real (px lógicos, 0-1920) del elemento visible más bajo, medido
  // desde el DOM (cada dato tiene alto distinto: tiempo hero es más alto
  // que un badge de PR). Se usa para anclar el logo justo debajo del
  // último dato, en vez de siempre pegado al fondo del lienzo. Se
  // re-mide cada vez que cambian los elementos (posición, tamaño,
  // visibilidad) vía useLayoutEffect + los refs que cada elemento
  // registra en `elementNodesRef`.
  const elementNodesRef = useRef<Map<StickerFieldId, HTMLDivElement>>(new Map());
  const [contentBottomPx, setContentBottomPx] = useState<number>(
    CANVAS_HEIGHT * DEFAULT_CONTENT_BOTTOM_FRACTION,
  );

  const registerElementNode = useCallback((fieldId: StickerFieldId, node: HTMLDivElement | null) => {
    if (node) {
      elementNodesRef.current.set(fieldId, node);
    } else {
      elementNodesRef.current.delete(fieldId);
    }
  }, []);

  const visibleElements = elements.filter((el) => el.visible);

  // Recalcula el bottom del contenido cada vez que la lista de elementos
  // visibles, sus posiciones o sus escalas cambian. useLayoutEffect (no
  // useEffect) para medir el DOM ya pintado antes del siguiente paint,
  // evitando parpadeo del logo al moverse el último elemento.
  useLayoutEffect(() => {
    if (visibleElements.length === 0) {
      setContentBottomPx(CANVAS_HEIGHT * DEFAULT_CONTENT_BOTTOM_FRACTION);
      return;
    }
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const canvasRect = canvasNode.getBoundingClientRect();
    // getBoundingClientRect ya viene en px de PANTALLA (post-scaleRatio) —
    // hay que dividir por scaleRatio para volver a px LÓGICOS (0-1920),
    // que es el sistema de coordenadas en el que vive todo lo demás
    // (element.x/y, CANVAS_HEIGHT, etc).
    let maxBottom = 0;
    for (const el of visibleElements) {
      const node = elementNodesRef.current.get(el.fieldId);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const bottomLogical = (rect.bottom - canvasRect.top) / scaleRatio;
      if (bottomLogical > maxBottom) maxBottom = bottomLogical;
    }
    setContentBottomPx(maxBottom > 0 ? maxBottom : CANVAS_HEIGHT * DEFAULT_CONTENT_BOTTOM_FRACTION);
    // Dependemos de un JSON.stringify de las posiciones/escalas porque
    // los propios objetos `elements` cambian de referencia en cada drag
    // frame — necesitamos recalcular en cada uno de esos frames para que
    // el logo siga al último elemento en tiempo real mientras se arrastra,
    // no solo al soltar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(visibleElements.map((e) => [e.fieldId, e.x, e.y, e.scale])),
    scaleRatio,
  ]);

  // Centro vertical del logo: justo debajo del último elemento visible
  // (con un margen mínimo), pero sin bajar de un tope cerca del fondo del
  // lienzo — así nunca se solapa con el contenido si éste ocupa casi todo
  // el alto disponible, ni se sale por debajo del lienzo.
  const logoCenterY = Math.min(
    CANVAS_HEIGHT - LOGO_BOTTOM_PADDING_PX - LOGO_HEIGHT_PX / 2,
    contentBottomPx + LOGO_MIN_MARGIN_PX + LOGO_HEIGHT_PX / 2,
  );

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
        {visibleElements.map((el) => (
          <StickerElementView
            key={el.fieldId}
            element={el}
            data={data}
            isSelected={selectedFieldId === el.fieldId}
            onSelect={() => onSelect(el.fieldId)}
            onMove={(x, y) => onMove(el.fieldId, x, y)}
            onResize={(scale) => onResize(el.fieldId, scale)}
            onSnapChange={setSnapLines}
            dragContainerRef={canvasRef}
            registerNode={registerElementNode}
          />
        ))}

        {/* Líneas guía de centrado — solo visibles mientras se arrastra un
            elemento que cae dentro del umbral de snap. No forman parte
            del PNG exportado en un sentido estricto (viven dentro de
            canvasRef), pero solo se renderizan durante el drag activo, y
            un drag activo nunca coincide con el momento de exportar, así
            que nunca aparecen en el PNG real. */}
        {snapLines.x && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              backgroundColor: "#4ade80",
              transform: "translateX(-1px)",
              pointerEvents: "none",
              zIndex: 50,
            }}
          />
        )}
        {snapLines.y && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: "#4ade80",
              transform: "translateY(-1px)",
              pointerEvents: "none",
              zIndex: 50,
            }}
          />
        )}

        {/* Logo mi-dorsal — siempre visible, no forma parte de `elements`
            (no se puede ocultar, mover ni redimensionar). Va dentro del
            nodo capturado por html-to-image, así que sí sale en el PNG.
            Anclado justo debajo del último dato visible (con un margen
            mínimo), no siempre pegado al fondo — así no queda un hueco
            grande entre el contenido y el logo cuando hay pocos datos. */}
        <div
          style={{
            position: "absolute",
            top: `${logoCenterY}px`,
            left: 0,
            right: 0,
            transform: "translateY(-50%)",
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
  onSnapChange,
  dragContainerRef,
  registerNode,
}: {
  element: StickerElementLayout;
  data: StickerData;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (scale: number) => void;
  /** Se llama en cada frame de un drag de MOVER (no de resize) con qué
   *  líneas guía deben mostrarse — `{x: true}` cuando el elemento cae
   *  dentro del umbral de enganche al centro horizontal del lienzo,
   *  `{y: true}` para el centro vertical. Se llama con `{x:false,
   *  y:false}` al soltar. */
  onSnapChange: (lines: { x: boolean; y: boolean }) => void;
  /** El lienzo completo (1080x1920 lógico, escalado visualmente con CSS
   *  transform), NO el propio elemento — el delta de arrastre debe
   *  normalizarse contra el tamaño del lienzo, no contra un elemento que
   *  cambia de tamaño mientras lo redimensionas (eso crearía un bucle de
   *  feedback: el delta cambiaría de escala en cada frame de resize). */
  dragContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Registra/desregistra el nodo DOM de este elemento en el mapa que
   *  StickerCanvas usa para medir dónde cae el borde inferior real del
   *  contenido (para anclar el logo justo debajo). */
  registerNode: (fieldId: StickerFieldId, node: HTMLDivElement | null) => void;
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

  const setWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      registerNode(element.fieldId, node);
    },
    [element.fieldId, registerNode],
  );

  const moveDrag = usePointerDrag(
    dragContainerRef,
    (deltaX, deltaY) => {
      const current = elementRef.current;
      let nextX = Math.min(1, Math.max(0, current.x + deltaX));
      let nextY = Math.min(1, Math.max(0, current.y + deltaY));

      // Snap al centro: si la nueva posición cae dentro del umbral del
      // centro del lienzo en cualquiera de los dos ejes, se "engancha"
      // exactamente a 0.5 en ese eje (en vez de dejar que quede a medio
      // píxel del centro) y se enciende la línea guía correspondiente.
      const snapX = Math.abs(nextX - 0.5) < CENTER_SNAP_THRESHOLD;
      const snapY = Math.abs(nextY - 0.5) < CENTER_SNAP_THRESHOLD;
      if (snapX) nextX = 0.5;
      if (snapY) nextY = 0.5;
      onSnapChange({ x: snapX, y: snapY });

      onMove(nextX, nextY);
    },
    () => onSnapChange({ x: false, y: false }),
  );

  const resizeDrag = usePointerDrag(dragContainerRef, (deltaX) => {
    const current = elementRef.current;
    const nextScale = Math.min(3, Math.max(0.3, current.scale + deltaX * 2));
    onResize(nextScale);
  });

  return (
    <div
      ref={setWrapperRef}
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
