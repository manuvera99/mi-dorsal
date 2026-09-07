"use client";

/**
 * PredictionsCard — muestra el VDOT del usuario y las predicciones para
 * 4 distancias estándar (5K, 10K, media maratón, maratón).
 *
 * Cálculo en cliente con `lib/prediction/` (mismo código que usa el
 * backend para predecir `myRaces.predictedTimeSeconds`). Sin llamadas
 * extra a Convex: 100% derivado de los PRs que ya tienes en memoria.
 *
 * Regla UX: solo se muestra cuando el usuario tiene al menos 1 PR
 * (en /perfil, el padre decide si renderizar o no).
 */

import { Sparkles, TrendingUp } from "lucide-react";
import { calculateVDOT, predictTimeFromVDOT } from "@/lib/prediction/daniels-vdot";
import { predictTimeRiegel } from "@/lib/prediction/riegel";
import { formatTime } from "@/lib/utils";

interface PRForPrediction {
  distanceM: number;
  distanceLabel: string;
  timeSeconds: number;
}

interface PredictionsCardProps {
  prs: PRForPrediction[];
}

const PREDICTION_DISTANCES: Array<{ label: string; meters: number }> = [
  { label: "5K", meters: 5000 },
  { label: "10K", meters: 10000 },
  { label: "Media maratón", meters: 21097 },
  { label: "Maratón", meters: 42195 },
];

export function PredictionsCard({ prs }: PredictionsCardProps) {
  const lowConfidence = prs.length === 1;
  if (prs.length === 0) return null;

  // Encontrar el PR más rápido (menor timeSeconds) — es el que mejor
  // refleja el estado actual del corredor.
  const bestPR = prs.reduce((best, pr) =>
    pr.timeSeconds < best.timeSeconds ? pr : best,
  );

  let vdot: number;
  let predictions: Array<{ label: string; meters: number; seconds: number }>;
  try {
    vdot = calculateVDOT(bestPR.distanceM, bestPR.timeSeconds);
    predictions = PREDICTION_DISTANCES.map(({ label, meters }) => {
      let seconds: number;
      try {
        seconds = predictTimeFromVDOT(vdot, meters);
      } catch {
        // fallback a Riegel
        seconds = predictTimeRiegel(bestPR.timeSeconds, bestPR.distanceM, meters);
      }
      return { label, meters, seconds };
    });
  } catch (e) {
    // PR inválido o error inesperado
    return (
      <div className="card">
        <p className="text-sm text-stone-500">
          No hemos podido calcular tus predicciones. Revisa que tus marcas
          tengan tiempo y distancia correctos.
        </p>
      </div>
    );
  }

  // Confianza: más PRs = más confianza
  const confidenceLabel =
    prs.length >= 4
      ? "Alta"
      : prs.length >= 2
        ? "Media"
        : "Baja — añade más marcas para mejorarla";

  return (
    <div className="card border-runner-primary/20 bg-gradient-to-br from-white to-red-50/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-runner-dark">
            <Sparkles className="h-5 w-5 text-runner-primary" />
            Tu VDOT es {Math.round(vdot)}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Calculado desde tu mejor marca: {bestPR.distanceLabel} en{" "}
            <span className="font-mono font-semibold text-stone-700">
              {formatTime(bestPR.timeSeconds)}
            </span>
          </p>
        </div>
        <span className="badge badge-red flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {confidenceLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {predictions.map((p) => {
          // Si la distancia objetivo ES la del PR best, mostramos el PR real
          // (no la predicción) para que el usuario vea su tiempo.
          const isCurrentBest = p.meters === bestPR.distanceM;
          // Con un solo PR, la predicción de maratón es muy optimista.
          // La mostramos en gris y tachada para no engañar al usuario.
          const isLowConfidenceMarathon = lowConfidence && p.label === "Maratón" && !isCurrentBest;
          return (
            <div
              key={p.label}
              className={
                "rounded-lg p-3 border " +
                (isCurrentBest
                  ? "border-runner-primary bg-runner-primary/5"
                  : isLowConfidenceMarathon
                    ? "border-stone-200 bg-stone-50 opacity-60"
                    : "border-stone-200 bg-white")
              }
              title={isLowConfidenceMarathon ? "Predicción poco fiable con un solo PR. Añade más marcas." : undefined}
            >
              <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold mb-1">
                {p.label}
                {isCurrentBest && (
                  <span className="ml-1 text-runner-primary normal-case tracking-normal">
                    (tu PR)
                  </span>
                )}
                {isLowConfidenceMarathon && (
                  <span className="ml-1 text-stone-400 normal-case tracking-normal text-[9px]">
                    (poco fiable)
                  </span>
                )}
              </div>
              <div className={"text-xl md:text-2xl font-bold text-runner-dark font-mono " + (isLowConfidenceMarathon ? "line-through text-stone-400" : "")}>
                {formatTime(isCurrentBest ? bestPR.timeSeconds : p.seconds)}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-stone-400 mt-4 leading-relaxed">
        Predicciones con el método Daniels (VDOT). Más marcas = predicciones
        más afinadas. Las marcas son tuyas, no las del GPS: para nosotros,
        el oficial siempre manda.
      </p>
    </div>
  );
}
