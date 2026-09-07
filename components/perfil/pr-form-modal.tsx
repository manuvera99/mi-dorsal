"use client";

// =============================================================================
// mi-dorsal — Modal para añadir/editar una marca personal (PR) a mano
// =============================================================================
// Cubre el caso del usuario sin Strava conectado (o que quiere corregir/
// completar una distancia que Strava no detectó). Usa la misma mutation
// `personalRecords.upsert` que ya usa el flujo automático — si el tiempo
// no mejora el PR actual de esa distancia, la mutation simplemente no hace
// nada (lo avisamos en el formulario, no es un error).
// =============================================================================

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Loader2 } from "lucide-react";

// Debe coincidir con PR_DISTANCES_M en convex/activities/normalize.ts.
const PR_DISTANCES: { distanceM: number; label: string }[] = [
  { distanceM: 5000, label: "5K" },
  { distanceM: 10000, label: "10K" },
  { distanceM: 15000, label: "15K" },
  { distanceM: 21097, label: "Media maratón" },
  { distanceM: 42195, label: "Maratón" },
  { distanceM: 50000, label: "50K" },
  { distanceM: 80467, label: "50 millas" },
  { distanceM: 100000, label: "100K" },
  { distanceM: 160934, label: "100 millas" },
];

function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d{1,2}$/.test(p))) return null;

  let h = 0, m = 0, s = 0;
  if (parts.length === 3) {
    [h, m, s] = parts.map(Number);
  } else {
    [m, s] = parts.map(Number);
  }
  if (m >= 60 || s >= 60) return null;

  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

export function PrFormModal({ onClose }: { onClose: () => void }) {
  const upsertPr = useMutation(api.personalRecords.upsert);

  const [distanceM, setDistanceM] = useState<number>(PR_DISTANCES[0].distanceM);
  const [timeInput, setTimeInput] = useState("");
  const [achievedAt, setAchievedAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const timeSeconds = parseTimeToSeconds(timeInput);
    if (timeSeconds === null) {
      setError("Formato de tiempo no válido. Usa MM:SS o HH:MM:SS (ej. 22:34 o 3:15:00).");
      return;
    }

    const distance = PR_DISTANCES.find((d) => d.distanceM === distanceM);
    if (!distance) return;

    setSaving(true);
    try {
      const result = await upsertPr({
        distanceM: distance.distanceM,
        distanceLabel: distance.label,
        timeSeconds,
        achievedAt: achievedAt || undefined,
      });

      if (!result.saved) {
        setNotice(
          "Este tiempo no mejora tu marca actual en esta distancia, así que no se ha guardado. Si quieres corregir un dato mal introducido, borra primero el PR existente.",
        );
        setSaving(false);
        return;
      }

      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar la marca");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Añadir marca personal"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Añadir marca personal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pr-distance" className="block text-sm font-medium text-gray-700 mb-1">
              Distancia
            </label>
            <select
              id="pr-distance"
              value={distanceM}
              onChange={(e) => setDistanceM(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {PR_DISTANCES.map((d) => (
                <option key={d.distanceM} value={d.distanceM}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pr-time" className="block text-sm font-medium text-gray-700 mb-1">
              Tu tiempo
            </label>
            <input
              id="pr-time"
              type="text"
              inputMode="numeric"
              placeholder="MM:SS o HH:MM:SS (ej. 22:34)"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              required
            />
          </div>

          <div>
            <label htmlFor="pr-date" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha (opcional)
            </label>
            <input
              id="pr-date"
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}
          {notice && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
              {notice}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                </span>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
