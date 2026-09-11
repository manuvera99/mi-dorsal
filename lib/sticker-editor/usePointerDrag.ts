// =============================================================================
// mi-dorsal — usePointerDrag
// =============================================================================
// Hook genérico para arrastrar/redimensionar elementos del editor de
// sticker con Pointer Events nativos (funciona con mouse y touch sin
// código separado). No sabe nada de "elementos del sticker" — solo emite
// deltas normalizados (0-1) respecto al tamaño de un contenedor de
// referencia. StickerCanvas.tsx lo usa dos veces: una para mover, otra
// para redimensionar (con distinto onDelta).
// =============================================================================

"use client";

import { useCallback, useEffect, useRef } from "react";

export interface PointerDragHandlers {
  /** Poner en onPointerDown del elemento arrastrable. */
  onPointerDown: (e: React.PointerEvent) => void;
}

/**
 * `containerRef` debe apuntar al lienzo (el elemento cuyo tamaño define la
 * escala 0-1 de los deltas). `onDelta` se llama en cada movimiento con el
 * delta normalizado desde el punto de inicio del drag; `onDragEnd` se
 * llama una vez al soltar.
 */
export function usePointerDrag(
  containerRef: React.RefObject<HTMLElement | null>,
  onDelta: (deltaX: number, deltaY: number) => void,
  onDragEnd?: () => void,
): PointerDragHandlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // pointerId del drag activo — filtra eventos de otros punteros (multi-touch,
  // o eventos de otra instancia del hook) para que no contaminen este drag.
  const activePointerIdRef = useRef<number | null>(null);
  // Función para retirar los listeners de window del drag en curso, si hay
  // uno. Se guarda en un ref para poder invocarla también desde el efecto
  // de desmontaje, no solo desde handleUp.
  const cleanupRef = useRef<(() => void) | null>(null);

  // Limpieza si el componente se desmonta a mitad de un drag (ej. el
  // usuario cambia de plantilla mientras arrastra un elemento) — sin esto,
  // los listeners de window quedarían huérfanos indefinidamente porque
  // "pointerup" nunca llega a disparar.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      cleanupRef.current?.();
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      startRef.current = { x: e.clientX, y: e.clientY };
      activePointerIdRef.current = e.pointerId;

      const cleanup = () => {
        startRef.current = null;
        activePointerIdRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        cleanupRef.current = null;
      };

      const handleMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activePointerIdRef.current) return;
        if (!startRef.current) return;
        const deltaX = (moveEvent.clientX - startRef.current.x) / rect.width;
        const deltaY = (moveEvent.clientY - startRef.current.y) / rect.height;
        onDelta(deltaX, deltaY);
        startRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      };

      const handleUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== activePointerIdRef.current) return;
        cleanup();
        onDragEnd?.();
      };

      cleanupRef.current = cleanup;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [containerRef, onDelta, onDragEnd],
  );

  return { onPointerDown };
}
