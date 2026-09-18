"use client";

/**
 * PersonalRecordEditor — editor inline del PR (personal record) en una card
 * del calendario.
 *
 * El usuario puede hacer clic sobre el PR que se muestra en la card y:
 *  1. Editar el tiempo (HH:MM:SS).
 *  2. Guardarlo. La edicion se aplica al PR GLOBAL de la distancia en la
 *     tabla `personalRecords` (afecta a TODAS las cards de esa distancia,
 *     no solo a la carrera actual).
 *
 * Diferencias con la `upsert` mutation de personalRecords:
 *  - `upsert` rechaza tiempos peores (no hace nada si timeSeconds >= current).
 *    Sirve para añadir PRs nuevos automaticamente.
 *  - `updateManualPR` (la que usamos aqui) SIEMPRE sobrescribe. El usuario
 *    es dueno de su PR y puede corregirlo a mano, bajarlo a proposito, etc.
 *
 * Stack: client component. Sin fetches (usa el mutation de Convex).
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, Pencil, Check, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn, formatTime, parseTimeHMS } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface PersonalRecordEditorProps {
  /** Distancia del PR en metros (la edicion aplica al PR global de esta distancia). */
  distanceM: number;
  /** Etiqueta de la distancia para mostrar al usuario y guardar en la fila. */
  distanceLabel: string;
  /** Tiempo actual del PR en segundos (o null si no hay PR). */
  currentTimeSeconds: number | null;
  /** Etiqueta visible del usuario, e.g. "Tu PR en 15 km". */
  userLabel?: string;
}

export function PersonalRecordEditor({
  distanceM,
  distanceLabel,
  currentTimeSeconds,
  userLabel,
}: PersonalRecordEditorProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState<string>(
    currentTimeSeconds ? formatTime(currentTimeSeconds) : "",
  );
  const [saving, setSaving] = useState(false);
  const updatePR = useMutation(api.personalRecords.updateManualPR);
  const toast = useToast();

  const startEdit = () => {
    setInput(currentTimeSeconds ? formatTime(currentTimeSeconds) : "");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setInput(currentTimeSeconds ? formatTime(currentTimeSeconds) : "");
  };

  const handleSave = async () => {
    const secs = parseTimeHMS(input);
    if (secs === null || secs < 1) {
      toast.show({
        variant: "warning",
        title: "Tiempo no valido",
        description: "Usa H:MM:SS, M:SS o MM:SS. Ej: 1:26:14 o 28:42.",
      });
      return;
    }
    setSaving(true);
    try {
      await updatePR({
        distanceM,
        distanceLabel,
        timeSeconds: secs,
      });
      toast.show({
        variant: "info",
        title: "PR actualizado",
        description: "Tu mejor marca en esta distancia se ha guardado.",
      });
      setEditing(false);
    } catch (e) {
      toast.show({
        variant: "warning",
        title: "No se pudo guardar el PR",
        description: "Intentalo de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Vista: solo lectura, clickable para entrar en edicion.
  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "group/pr flex w-full items-baseline justify-between gap-2 rounded-md bg-stone-50 px-3 py-2 text-left transition-colors hover:bg-stone-100",
        )}
        aria-label={
          currentTimeSeconds
            ? `Editar ${userLabel ?? `tu PR en ${distanceLabel}`}: ${formatTime(currentTimeSeconds)}`
            : `Añadir ${userLabel ?? `tu PR en ${distanceLabel}`}`
        }
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {userLabel ?? `Tu PR en ${distanceLabel}`}
        </span>
        <span className="flex items-center gap-2">
          {currentTimeSeconds ? (
            <span className="font-mono text-sm font-bold text-stone-700">
              {formatTime(currentTimeSeconds)}
            </span>
          ) : (
            <span className="text-xs text-stone-400">Sin PR</span>
          )}
          <Pencil
            className="h-3 w-3 text-stone-400 transition-colors group-hover/pr:text-runner-primary"
            aria-hidden="true"
          />
        </span>
      </button>
    );
  }

  // Vista: edicion.
  return (
    <div className="rounded-md bg-stone-50 px-3 py-2">
      <label
        htmlFor={`pr-input-${distanceM}`}
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500"
      >
        {userLabel ?? `Tu PR en ${distanceLabel}`}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`pr-input-${distanceM}`}
          type="text"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
            if (e.key === "Escape") cancel();
          }}
          placeholder="1:26:14 o 28:42"
          className="flex-1 rounded border border-stone-300 bg-white px-2 py-1 font-mono text-sm font-bold text-stone-700 outline-none focus:border-runner-primary focus:ring-2 focus:ring-runner-primary/20"
          autoFocus
          aria-label="Tiempo del PR"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded bg-runner-primary p-1.5 text-white shadow-sm transition-opacity hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Guardar PR"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="inline-flex items-center justify-center rounded border border-stone-300 bg-white p-1.5 text-stone-500 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}