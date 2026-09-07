"use client";

// =============================================================================
// mi-dorsal — Runner type card
// =============================================================================
// Muestra el "tipo de corredor" calculado con heurísticas. Si hay tags, los
// muestra con su score. Al hacer click en "Auditar", abre un modal con el
// desglose de cada input que ha producido cada tag.
// =============================================================================

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sparkles, Info, X, TrendingUp, MapPin, Activity, Heart, Clock } from "lucide-react";

const TAG_LABELS: Record<string, string> = {
  sprinter: "Sprinter",
  fondista: "Fondista",
  ultra_runner: "Ultra runner",
  trail_puro: "Trail puro",
  asfalto_puro: "Asfalto puro",
  mixto: "Mixto",
  consistente: "Consistente",
  volumen_alto: "Volumen alto",
  principiante: "Principiante",
  recuperador: "Recuperador",
  corredor_popular: "Corredor popular",
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  sprinter: "Predominan distancias cortas con cadencia alta",
  fondista: "Tu zona son las medias y maratones",
  ultra_runner: "Te vas más allá de los 42K",
  trail_puro: "Más del 60% de tu actividad es trail con desnivel",
  asfalto_puro: "Tu terreno es el asfalto",
  mixto: "Combinas asfalto y trail",
  consistente: "Entrenas con regularidad durante la semana",
  volumen_alto: "Acumulas muchos km a la semana",
  principiante: "Llevas poco tiempo con el hábito",
  recuperador: "Predominan los rodajes suaves",
  corredor_popular: "Corres muchas carreras al año",
};

// Tags genéricos que, si son el top, ocultamos o reordenamos.
// Estos no aportan información específica sobre el tipo de corredor.
const GENERIC_TAGS = new Set([
  "consistente",
  "volumen_alto",
  "principiante",
  "recuperador",
  "corredor_popular",
]);

export function RunnerTypeCard() {
  const runnerType = useQuery(api.activities.queries.getMyRunnerType, {});
  const stats = useQuery(api.activities.queries.getMyActivityStats, {});
  const [showAudit, setShowAudit] = useState(false);

  if (runnerType === undefined || stats === undefined) {
    return <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />;
  }

  if (stats.totalActivities === 0) {
    // Empty state: usuario sin actividades. Le explicamos para qué sirve.
    return (
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-runner-primary" />
            <h2 className="text-lg font-semibold">Tu tipo de corredor</h2>
          </div>
        </div>
        <div className="text-center py-6 px-2">
          <div
            aria-hidden="true"
            className="inline-flex items-center justify-center mb-3 h-12 w-12 rounded-full bg-runner-warm text-runner-primary"
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-stone-900 mb-1">
            Te lo calculamos cuando subas actividades
          </h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto mb-4 leading-relaxed">
            Detectamos si eres sprinter, fondista, trailero, mixto…
            con reglas transparentes, no con un modelo opaco.
          </p>
          <a
            href="#conexiones"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-runner-primary hover:underline"
          >
            Conectar Strava o subir export →
          </a>
        </div>
      </div>
    );
  }

  // Priorizar tags específicos (sprinter, fondista, trail_puro, etc.) sobre
  // genéricos (consistente, volumen_alto, corredor_popular, etc.).
  // Si el top tag es genérico, lo desplazamos hacia abajo y ponemos uno
  // específico primero. Si TODOS son genéricos, los mostramos igual.
  const sortedTags = [...runnerType.tags].sort((a, b) => {
    const aGeneric = GENERIC_TAGS.has(a.tag);
    const bGeneric = GENERIC_TAGS.has(b.tag);
    if (aGeneric === bGeneric) return b.score - a.score;
    return aGeneric ? 1 : -1; // específicos primero
  });
  const tags = sortedTags.slice(0, 3);

  return (
    <div className="card mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-runner-primary" />
          <h2 className="text-lg font-semibold">Tu tipo de corredor</h2>
        </div>
        {tags.length > 0 && (
          <button
            onClick={() => setShowAudit(true)}
            className="text-xs text-runner-primary hover:underline flex items-center gap-1"
          >
            <Info className="h-3.5 w-3.5" />
            Auditar
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500">
          Sigue entrenando y subiendo actividades. Con más datos calcularemos tu tipo.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Detectado a partir de{" "}
            <span className="font-semibold text-gray-900">
              {stats.totalActivities} actividades
            </span>
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((t) => (
              <span
                key={t.tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-runner-primary/10 text-runner-primary rounded-full text-sm font-medium"
              >
                {TAG_LABELS[t.tag] ?? t.tag}
                <span className="text-xs text-runner-primary/70">
                  {t.score.toFixed(0)}
                </span>
              </span>
            ))}
          </div>

          {tags.length > 0 && (
            <p className="text-xs text-gray-500">
              {TAG_DESCRIPTIONS[tags[0].tag] ?? ""}
            </p>
          )}
        </>
      )}

      {showAudit && (
        <AuditModal tags={tags} onClose={() => setShowAudit(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de auditoría: muestra el desglose completo
// ---------------------------------------------------------------------------

function AuditModal({
  tags,
  onClose,
}: {
  tags: { tag: string; score: number; reason: string }[];
  onClose: () => void;
}) {
  const stats = useQuery(api.activities.queries.getMyActivityStats, {});

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cómo calculamos tu tipo de corredor</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Tu tipo se calcula con reglas transparentes, no con un modelo opaco.
          Aquí ves cada input que ha producido cada tag.
        </p>

        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tags para auditar.</p>
        ) : (
          <div className="space-y-4">
            {tags.map((t) => (
              <div key={t.tag} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">
                    {TAG_LABELS[t.tag] ?? t.tag}
                  </h3>
                  <div className="text-sm font-mono font-semibold text-runner-primary">
                    {t.score.toFixed(0)}/100
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-runner-primary"
                    style={{ width: `${t.score}%` }}
                  />
                </div>
                <p className="text-sm text-gray-700">{t.reason}</p>
              </div>
            ))}
          </div>
        )}

        {stats && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Tus estadísticas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <StatBox
                icon={<Activity className="h-3.5 w-3.5" />}
                label="Actividades"
                value={String(stats.totalActivities)}
              />
              <StatBox
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Distancia total"
                value={`${Math.round(stats.totalDistanceKm)} km`}
              />
              <StatBox
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Mediana km/sem"
                value={Math.round(stats.weeklyVolumeMedianKm).toString()}
              />
              <StatBox
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Consistencia"
                value={`${(stats.consistencyPct * 100).toFixed(0)}%`}
              />
              <StatBox
                icon={<Heart className="h-3.5 w-3.5" />}
                label="Cadencia easy"
                value={
                  stats.avgCadenceSpm
                    ? `${Math.round(stats.avgCadenceSpm)} spm`
                    : "—"
                }
              />
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-6 w-full btn-primary">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-gray-200 rounded-md p-2">
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}
