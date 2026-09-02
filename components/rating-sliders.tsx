"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isMockMode } from "@/lib/mock/provider";
import { Save } from "lucide-react";

interface RatingSlidersProps {
  raceId: string | Id<"races">;
}

const DIMENSIONS = [
  { key: "organization", label: "Organización y logística", icon: "📋" },
  { key: "price", label: "Precio", icon: "💸" },
  { key: "swag", label: "Bolsa del corredor", icon: "🎽" },
  { key: "aidStations", label: "Avituallamientos", icon: "🥤" },
  { key: "course", label: "Perfil y recorrido", icon: "⛰️" },
  { key: "atmosphere", label: "Ambiente y animación", icon: "🎉" },
  { key: "postRace", label: "Servicios post-meta", icon: "🍻" },
  { key: "trophies", label: "Trofeos", icon: "🏆" },
] as const;

export function RatingSliders({ raceId }: RatingSlidersProps) {
  const useMock = isMockMode();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])),
  );
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const upsert = useMutation(api.ratings.upsert);

  const allValid = DIMENSIONS.every((d) => values[d.key] > 0);

  const handleSave = async () => {
    if (useMock) {
      // Mock: just show success
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    try {
      await upsert({
        raceId: raceId as any,
        ...values,
        comment: comment || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Error guardando valoración");
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">¿La has corrido? Valórala</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tu valoración ayuda a otros corredores. Solo se puede votar una vez por carrera.
      </p>

      <div className="space-y-4">
        {DIMENSIONS.map((dim) => {
          const val = values[dim.key];
          const color =
            val >= 8 ? "text-green-600" : val >= 5 ? "text-yellow-600" : val > 0 ? "text-red-500" : "text-gray-400";
          return (
            <div key={dim.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <span>{dim.icon}</span> {dim.label}
                </label>
                <span className={`font-mono font-bold ${color}`}>{val}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={val}
                onChange={(e) => setValues({ ...values, [dim.key]: Number(e.target.value) })}
                className="w-full"
                style={{
                  background: `linear-gradient(90deg, #dc2626 0%, #dc2626 ${val * 10}%, #e5e7eb ${val * 10}%, #e5e7eb 100%)`,
                  height: "8px",
                  borderRadius: "6px",
                  appearance: "none",
                  outline: "none",
                }}
              />
            </div>
          );
        })}

        <div>
          <label className="label mb-1 block">Comentario (opcional)</label>
          <textarea
            className="input min-h-[60px]"
            placeholder="¿Qué destacarías de esta carrera?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!allValid}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saved ? (
            <>✅ Guardado</>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              Guardar valoración
            </>
          )}
        </button>
      </div>
    </div>
  );
}
