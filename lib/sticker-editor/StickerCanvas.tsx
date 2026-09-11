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

// Margen (en px LÓGICOS, mismo valor absoluto en ambos ejes) dentro del
// cual un elemento se "engancha" al centro del lienzo o al centro de otro
// elemento al arrastrarlo. Se usa tanto para el snap al centro del lienzo
// como para la alineación entre elementos — un solo valor en px evita que
// el eje Y (lienzo de 1920px) tenga un umbral casi el doble de grande que
// el eje X (1080px) si se expresara como fracción 0-1 fija. Valor bajo
// (10px) a propósito: con un umbral más alto el elemento se queda "pegado"
// al punto de enganche y cuesta mucho volver a moverlo desde ahí.
const SNAP_THRESHOLD_PX = 10;
const SNAP_THRESHOLD_X = SNAP_THRESHOLD_PX / CANVAS_WIDTH;
const SNAP_THRESHOLD_Y = SNAP_THRESHOLD_PX / CANVAS_HEIGHT;

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
};

interface StickerCanvasProps {
  elements: StickerElementLayout[];
  data: StickerData;
  selectedFieldId: StickerFieldId | null;
  onSelect: (fieldId: StickerFieldId | null) => void;
  onMove: (fieldId: StickerFieldId, x: number, y: number) => void;
  onResize: (fieldId: StickerFieldId, scale: number) => void;
  onDelete: (fieldId: StickerFieldId) => void;
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
  onDelete,
  displayWidth,
  canvasRef,
}: StickerCanvasProps) {
  const scaleRatio = displayWidth / CANVAS_WIDTH;
  const displayHeight = CANVAS_HEIGHT * scaleRatio;

  // Líneas guía activas mientras se arrastra un elemento: puede haber una
  // vertical (eje "x", enganche al centro horizontal del LIENZO o al
  // centro horizontal de OTRO elemento) y/o una horizontal (eje "y",
  // mismo criterio en vertical) simultáneamente. `pos` es la posición
  // normalizada (0-1) en la que dibujar la línea — para el centro del
  // lienzo siempre es 0.5, pero para alineación entre elementos es la
  // posición del elemento con el que se alinea.
  const [guideLines, setGuideLines] = useState<{
    x: number | null;
    y: number | null;
  }>({ x: null, y: null });

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
      {/* Wrapper de escala PURAMENTE visual — el transform vive aquí, FUERA
          de canvasRef. Si el transform estuviera en el propio canvasRef (como
          estaba antes), html-to-image capturaría el nodo ya escalado al
          ~30% (displayWidth/CANVAS_WIDTH) dentro de un lienzo de salida de
          1080x1920, dejando el contenido real encogido en la esquina
          superior izquierda del PNG en vez de ocupar todo el lienzo. */}
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scaleRatio})`,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={canvasRef}
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            position: "relative",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {visibleElements.map((el) => (
            <StickerElementView
              key={el.fieldId}
              element={el}
              allVisibleElements={visibleElements}
              data={data}
              isSelected={selectedFieldId === el.fieldId}
              onSelect={() => onSelect(el.fieldId)}
              onMove={(x, y) => onMove(el.fieldId, x, y)}
              onResize={(scale) => onResize(el.fieldId, scale)}
              onDelete={() => onDelete(el.fieldId)}
              onGuideLinesChange={setGuideLines}
              dragContainerRef={canvasRef}
              registerNode={registerElementNode}
            />
          ))}

          {/* Líneas guía — solo visibles mientras se arrastra un elemento
              que cae dentro del umbral de enganche, sea contra el centro
              del LIENZO (guideLines.x/y === 0.5) o contra el centro de
              OTRO elemento (guideLines.x/y === esa posición). No forman
              parte del PNG exportado en un sentido estricto (viven dentro
              de canvasRef), pero solo se renderizan durante el drag activo,
              y un drag activo nunca coincide con el momento de exportar,
              así que nunca aparecen en el PNG real. */}
          {guideLines.x != null && (
            <div
              style={{
                position: "absolute",
                left: `${guideLines.x * 100}%`,
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
          {guideLines.y != null && (
            <div
              style={{
                position: "absolute",
                top: `${guideLines.y * 100}%`,
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
    </div>
  );
}

function StickerElementView({
  element,
  allVisibleElements,
  data,
  isSelected,
  onSelect,
  onMove,
  onResize,
  onDelete,
  onGuideLinesChange,
  dragContainerRef,
  registerNode,
}: {
  element: StickerElementLayout;
  /** Todos los elementos visibles (incluido `element`), para poder
   *  comparar su centro contra el de los demás y detectar alineación
   *  mutua, no solo contra el centro del lienzo. */
  allVisibleElements: StickerElementLayout[];
  data: StickerData;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (scale: number) => void;
  onDelete: () => void;
  /** Se llama en cada frame de un drag de MOVER (no de resize) con la
   *  posición (0-1) en la que dibujar cada línea guía, o `null` si esa
   *  línea no debe mostrarse. Se llama con `{x: null, y: null}` al
   *  soltar. */
  onGuideLinesChange: (lines: { x: number | null; y: number | null }) => void;
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

  // Mismo motivo que elementRef: necesitamos la lista más reciente de
  // elementos visibles dentro del closure de onDelta (que se crea una
  // sola vez por el ciclo de vida del hook usePointerDrag, no en cada
  // render), para comparar contra sus posiciones ACTUALES, no las que
  // había cuando el usuario empezó a arrastrar.
  const allElementsRef = useRef(allVisibleElements);
  allElementsRef.current = allVisibleElements;

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

      // Snap al centro del LIENZO: si la nueva posición cae dentro del
      // umbral del centro en cualquiera de los dos ejes, se "engancha"
      // exactamente a 0.5 en ese eje.
      let snapX: number | null = Math.abs(nextX - 0.5) < SNAP_THRESHOLD_X ? 0.5 : null;
      let snapY: number | null = Math.abs(nextY - 0.5) < SNAP_THRESHOLD_Y ? 0.5 : null;

      // Snap contra OTROS elementos: si el centro del lienzo no atrapó
      // ya este eje, comprobamos si este elemento se alinea con el
      // centro (x o y) de cualquier otro elemento visible. El centro del
      // lienzo tiene prioridad porque es el punto de alineación más
      // "intencional" — dos elementos que casualmente están cerca uno
      // de otro sin que ninguno esté cerca del centro es menos relevante.
      if (snapX === null || snapY === null) {
        for (const other of allElementsRef.current) {
          if (other.fieldId === current.fieldId) continue;
          if (snapX === null && Math.abs(nextX - other.x) < SNAP_THRESHOLD_X) {
            snapX = other.x;
          }
          if (snapY === null && Math.abs(nextY - other.y) < SNAP_THRESHOLD_Y) {
            snapY = other.y;
          }
        }
      }

      if (snapX !== null) nextX = snapX;
      if (snapY !== null) nextY = snapY;
      onGuideLinesChange({ x: snapX, y: snapY });

      onMove(nextX, nextY);
    },
    () => onGuideLinesChange({ x: null, y: null }),
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
      onClick={(e) => {
        // El "click" (evento separado, disparado tras el pointerup) sigue
        // burbujeando hasta el contenedor del lienzo aunque el pointerdown
        // ya haya hecho stopPropagation — sin esto, el contenedor exterior
        // (onClick={() => onSelect(null)}, para deseleccionar al clicar el
        // fondo) deseleccionaba el elemento justo después de seleccionarlo,
        // así que el panel de Visible/Tamaño nunca llegaba a quedarse fijo.
        e.stopPropagation();
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
      <StickerFieldContent fieldId={element.fieldId} data={data} bgOpacity={element.bgOpacity} />
      {isSelected && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              position: "absolute",
              left: "-16px",
              top: "-16px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#dc2626",
              border: "3px solid white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "16px",
              fontWeight: 700,
              lineHeight: 1,
              padding: 0,
            }}
            aria-label="Eliminar elemento"
          >
            ×
          </button>
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
        </>
      )}
    </div>
  );
}

/** Convierte un color hex ("#rrggbb") a "rgba(r, g, b, alpha)", para poder
 *  aplicar la transparencia elegida por el usuario (bgOpacity) sobre un
 *  color de fondo sólido definido en PALETTE. */
function withOpacity(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Renderiza el contenido visual de cada fieldId. Sin lógica de posición
 *  (eso vive en el wrapper) — solo el "cómo se ve" cada dato. `bgOpacity`
 *  (0-1, elegido por el usuario con el slider de "Transparencia del
 *  fondo") solo afecta al rectángulo/pastilla de fondo, nunca al texto. */
function StickerFieldContent({
  fieldId,
  data,
  bgOpacity,
}: {
  fieldId: StickerFieldId;
  data: StickerData;
  bgOpacity: number;
}) {
  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    // bgOpacity=1 (default) reproduce el mismo blanco semi-translúcido de
    // siempre (0.92, no 1.0 puro) — bgOpacity solo actúa como multiplicador
    // hacia 0 (transparente total) desde ahí, nunca sube por encima de 0.92.
    backgroundColor: withOpacity("#ffffff", 0.92 * bgOpacity),
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
            {/* data.paceFormatted (formatPace) ya incluye el sufijo " /km" —
                no añadirlo aquí de nuevo o sale duplicado ("M:SS /km /km"). */}
            {data.paceFormatted ?? "—"}
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
            backgroundColor: withOpacity(PALETTE.prBg, bgOpacity),
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
        <div style={{ ...panelStyle, backgroundColor: withOpacity(PALETTE.primary, bgOpacity) }}>
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
          <div style={labelStyle}>Distancia</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "JetBrains Mono", color: PALETTE.ink }}>
            {data.distanceLabel ?? "—"}
          </div>
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
