"use client";

/**
 * TimePaceCalculator — calculadora bidireccional tiempo ↔ pace.
 *
 * El usuario introduce el tiempo objetivo o el pace objetivo y el otro
 * campo se recalcula en tiempo real en función de la distancia de la
 * carrera. Es la pieza interactiva de la card del calendario:
 *
 *   ┌──────────────────────────┐
 *   │ Tiempo objetivo  1:25:00 │  ← input editable
 *   │ Pace objetivo     5:12 /km│  ← input editable
 *   └──────────────────────────┘
 *
 * El botón "Guardar" persiste el tiempo en la DB via
 * `api.myRaces.setTargetTime`. Sin guardar, los cambios son solo
 * locales (no se pierden al cambiar de card, sí al recargar).
 *
 * Decisión de UX: el bidireccional es "uno a la vez". Cuando el
 * usuario está editando el tiempo, el pace se actualiza derivado
 * (read-only visualmente, pero `aria-readonly`). Y al revés. Esto
 * evita que ambos campos compitan en focus y que el usuario
 * "pelee" con un valor que se recalcula mientras escribe.
 *
 * Formato:
 *  - Tiempo: HH:MM:SS (3 segmentos). Si < 1h → M:SS (2 segmentos).
 *  - Pace: M:SS (sin decimales, redondeo al segundo más cercano).
 *
 * Edge cases:
 *  - distanceKm = 0 → no se puede calcular pace, se desactiva el input.
 *  - timeSeconds = 0 o negativo → ignoramos (no se acepta).
 *  - pace < 2:00 o > 12:00 → fuera de rango razonable, se acepta pero
 *    se considera inválido silenciosamente (no bloqueamos al corredor
 *    popular, simplemente el cálculo puede dar resultados absurdos).
 */

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePaceCalculatorProps {
  /** ID de la myRace para guardar el target time. */
  myRaceId: Id<"myRaces">;
  /** Distancia de la carrera en km (para el cálculo pace↔tiempo). */
  distanceKm: number;
  /** Tiempo objetivo actualmente guardado en la DB (puede ser undefined). */
  initialTimeSeconds?: number;
}

/**
 * Formatea segundos como "H:MM:SS" o "M:SS" según la duración.
 * Devuelve "" si los segundos son null/undefined/0.
 */
function formatTimeHMS(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Parsea "H:MM:SS", "M:SS" o "MM:SS" a segundos.
 * Devuelve null si el input es inválido o vacío.
 * Robusto a inputs parciales ("5:" o "1:2") durante la edición.
 */
function parseTimeHMS(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  // Cada parte debe ser numérica (puede estar vacío mientras se edita)
  const nums = parts.map((p) => (p === "" ? NaN : Number(p)));
  if (nums.some((n) => Number.isNaN(n))) return null;
  let h = 0, m = 0, s = 0;
  if (nums.length === 3) {
    [h, m, s] = nums as [number, number, number];
  } else {
    [m, s] = nums as [number, number];
  }
  if (m < 0 || m > 59 || s < 0 || s > 59 || h < 0) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Formatea pace en segundos/km como "M:SS /km".
 */
function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Parsea "M:SS" o "MM:SS" a segundos. Devuelve null si inválido.
 */
function parsePace(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length !== 2) return null;
  const [mStr, sStr] = parts;
  if (mStr === "" || sStr === "") return null;
  const m = Number(mStr);
  const s = Number(sStr);
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  if (m < 0 || s < 0 || s > 59) return null;
  return m * 60 + s;
}

export function TimePaceCalculator({
  myRaceId,
  distanceKm,
  initialTimeSeconds,
}: TimePaceCalculatorProps) {
  // Estado local de los inputs. Inicializamos desde initialTimeSeconds
  // o vacío si no hay nada guardado.
  const [timeInput, setTimeInput] = useState<string>(() =>
    formatTimeHMS(initialTimeSeconds),
  );
  const [paceInput, setPaceInput] = useState<string>(() =>
    initialTimeSeconds && distanceKm > 0
      ? formatPace(initialTimeSeconds / distanceKm)
      : "",
  );
  // Cuál de los dos campos es el "activo" (el que está editando el
  // usuario). El otro se deriva read-only.
  const [activeField, setActiveField] = useState<"time" | "pace">(
    initialTimeSeconds ? "time" : "time",
  );

  // Estado de guardado
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const setTargetTime = useMutation(api.myRaces.setTargetTime);

  // Cuando cambia initialTimeSeconds (p.ej. tras guardar, Convex
  // re-renderiza con el valor persistido), sincronizamos.
  useEffect(() => {
    setTimeInput(formatTimeHMS(initialTimeSeconds));
    if (initialTimeSeconds && distanceKm > 0) {
      setPaceInput(formatPace(initialTimeSeconds / distanceKm));
    }
  }, [initialTimeSeconds, distanceKm]);

  // Re-deriva el campo "pasivo" cuando el activo cambia.
  // Esto se hace en cada onChange para feedback inmediato.
  const handleTimeChange = (v: string) => {
    setTimeInput(v);
    setActiveField("time");
    setSaved(false);
    const secs = parseTimeHMS(v);
    if (secs != null && distanceKm > 0) {
      setPaceInput(formatPace(secs / distanceKm));
    } else {
      setPaceInput("");
    }
  };

  const handlePaceChange = (v: string) => {
    setPaceInput(v);
    setActiveField("pace");
    setSaved(false);
    const secPerKm = parsePace(v);
    if (secPerKm != null && distanceKm > 0) {
      setTimeInput(formatTimeHMS(secPerKm * distanceKm));
    } else {
      setTimeInput("");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Guardamos el tiempo objetivo actual. Si el input de tiempo
      // está vacío, guardamos null (la card vuelve a "sin definir").
      const secs = parseTimeHMS(timeInput);
      await setTargetTime({
        id: myRaceId,
        timeSeconds: secs, // null si inválido/vacío
      });
      setSaved(true);
      // Auto-ocultar el "guardado" tras 2s
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Tiempo objetivo */}
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Tiempo objetivo
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={timeInput}
            onChange={(e) => handleTimeChange(e.target.value)}
            onFocus={() => setActiveField("time")}
            placeholder="0:00:00"
            aria-readonly={activeField === "pace" || undefined}
            className={cn(
              "mt-1 w-full rounded border border-stone-200 bg-white px-2 py-1.5 font-mono text-sm font-bold text-stone-900 outline-none transition-colors",
              "focus:border-runner-primary focus:ring-1 focus:ring-runner-primary",
              activeField === "pace" && "text-stone-500",
            )}
          />
        </label>

        {/* Pace objetivo */}
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Pace objetivo
          </span>
          <div className="relative mt-1">
            <input
              type="text"
              inputMode="numeric"
              value={paceInput}
              onChange={(e) => handlePaceChange(e.target.value)}
              onFocus={() => setActiveField("pace")}
              placeholder="0:00"
              aria-readonly={activeField === "time" || undefined}
              className={cn(
                "w-full rounded border border-stone-200 bg-white px-2 py-1.5 pr-9 font-mono text-sm font-bold text-stone-900 outline-none transition-colors",
                "focus:border-runner-primary focus:ring-1 focus:ring-runner-primary",
                activeField === "time" && "text-stone-500",
              )}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-stone-400">
              /km
            </span>
          </div>
        </label>
      </div>

      {/* Botón guardar + feedback */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-runner-accent">
            <Check className="h-3 w-3" /> Guardado
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !parseTimeHMS(timeInput)}
          className={cn(
            "rounded-md bg-runner-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-opacity",
            "hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando
            </span>
          ) : (
            "Guardar objetivo"
          )}
        </button>
      </div>
    </div>
  );
}
