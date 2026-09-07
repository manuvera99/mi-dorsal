"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { Id } from "@/convex/_generated/dataModel";
import {
  Copy, AlertTriangle, Trash2, ExternalLink, MapPin, Calendar,
  Trophy, Loader2, CheckCircle2, XCircle, Filter, RefreshCw
} from "lucide-react";

type ReasonType = "exact" | "structural" | "fuzzy";

interface RaceSummary {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  locality: string | null;
  province: string | null;
  startDate: string | null;
  startTime: string | null;
  distanceKm: number;
  organizer: string | null;
  description: string | null;
  longDescription: string | null;
  officialUrl: string | null;
  registrationUrl: string | null;
  organizerUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  scraperAdapter: string | null;
  extractedAt: number | null;
  organizerLower: string | null;
  fieldsCount: number;
  keepSuggestion: boolean;
}

interface DuplicateGroup {
  key: string;
  reason: string;
  reasonType: ReasonType;
  races: RaceSummary[];
}

const REASON_LABELS: Record<ReasonType, { label: string; color: string; icon: string }> = {
  exact: { label: "Re-ingest", color: "bg-red-100 text-red-800 border-red-300", icon: "🔁" },
  structural: { label: "Misma fecha+lugar+distancia", color: "bg-amber-100 text-amber-800 border-amber-300", icon: "📍" },
  fuzzy: { label: "Nombre similar", color: "bg-blue-100 text-blue-800 border-blue-300", icon: "🔤" },
};

export default function DuplicatesPage() {
  const useMock = isMockMode();
  const [filterType, setFilterType] = useState<"all" | ReasonType>("all");
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const data = useQuery(
    api.races.adminFindDuplicates,
    useMock ? "skip" as any : { maxGroups: 100, similarityThreshold: 0.75 }
  );
  const deleteMany = useMutation(api.races.adminDeleteMany);

  const groups: DuplicateGroup[] = useMemo(() => {
    if (!data) return [];
    let g = data as DuplicateGroup[];
    if (filterType !== "all") g = g.filter((x) => x.reasonType === filterType);
    return g;
  }, [data, filterType]);

  // Calcular campos rellenos para cada race (en el cliente, rápido)
  const countFields = (r: any): number => {
    let n = 0;
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith("_") || k === "slug" || k === "scraperAdapter" || k === "extractedAt") continue;
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      n++;
    }
    return n;
  };

  // Para cada grupo, marcar la sugerencia de "keep" = la que tiene más campos
  const groupsWithSuggestion = useMemo(() => {
    return groups.map((g) => {
      const withCount = g.races.map((r) => ({ ...r, fieldsCount: countFields(r) }));
      const maxFields = Math.max(...withCount.map((r) => r.fieldsCount));
      const racesWithSuggestion = withCount.map((r) => ({
        ...r,
        keepSuggestion: r.fieldsCount === maxFields,
      }));
      return { ...g, races: racesWithSuggestion };
    });
  }, [groups]);

  const toggleDelete = (raceId: string) => {
    const newSet = new Set(toDelete);
    if (newSet.has(raceId)) newSet.delete(raceId);
    else newSet.add(raceId);
    setToDelete(newSet);
  };

  const selectSuggestedToDelete = (group: DuplicateGroup) => {
    const newSet = new Set(toDelete);
    for (const r of group.races) {
      if (!r.keepSuggestion) newSet.add(r._id);
    }
    setToDelete(newSet);
  };

  const handleApply = async () => {
    if (toDelete.size === 0) {
      setResult({ type: "err", msg: "Marca al menos una carrera para borrar" });
      return;
    }
    if (!confirm(`¿Borrar ${toDelete.size} carrera(s)? Esta acción no se puede deshacer.`)) return;
    setApplying(true);
    setResult(null);
    try {
      const ids = Array.from(toDelete) as Id<"races">[];
      const res = await deleteMany({ ids });
      setResult({ type: "ok", msg: `Borradas ${res.deleted} carrera(s). Recargando…` });
      setToDelete(new Set());
      // Convex hace refetch automático, no hace falta reload
    } catch (e: any) {
      setResult({ type: "err", msg: `Error: ${e?.message ?? e}` });
    } finally {
      setApplying(false);
    }
  };

  if (useMock) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Duplicados</h1>
        <p className="text-gray-500">Panel no disponible en mock mode.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Copy className="h-7 w-7" />
          Duplicados
        </h1>
        <div className="text-sm text-gray-500">
          {groupsWithSuggestion.length} grupo{groupsWithSuggestion.length === 1 ? "" : "s"} ·{" "}
          {toDelete.size} marcado{toDelete.size === 1 ? "" : "s"} para borrar
        </div>
      </div>
      <p className="text-gray-600 mb-6">
        Carreras candidatas a ser la misma. Marca las que quieres borrar (las marcadas con ✓ son las que tienen más datos y te las recomendamos conservar).
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Filter className="h-4 w-4 text-gray-500" />
        {(["all", "exact", "structural", "fuzzy"] as const).map((t) => {
          const count = t === "all" ? (data?.length ?? 0) : (data?.filter((g: any) => g.reasonType === t).length ?? 0);
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterType === t
                  ? "bg-runner-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "Todos" : REASON_LABELS[t as ReasonType].label}{" "}
              <span className="ml-1 text-xs opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Apply button flotante */}
      {toDelete.size > 0 && (
        <div className="sticky top-4 z-10 bg-white border-2 border-runner-primary rounded-lg shadow-lg p-4 mb-6 flex items-center justify-between">
          <div className="text-sm">
            <strong>{toDelete.size}</strong> carrera{toDelete.size === 1 ? "" : "s"} marcada{toDelete.size === 1 ? "" : "s"} para borrar
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setToDelete(new Set())}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Limpiar
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 bg-runner-primary text-white font-semibold rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Borrar {toDelete.size} carrera{toDelete.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {/* Resultado de la última acción */}
      {result && (
        <div
          className={`mb-6 p-3 rounded-md flex items-center gap-2 ${
            result.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {result.type === "ok" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          <span className="text-sm">{result.msg}</span>
        </div>
      )}

      {/* Lista de grupos */}
      {groupsWithSuggestion.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">No hay duplicados pendientes</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filterType === "all"
              ? "El catálogo está limpio."
              : `No hay duplicados del tipo "${REASON_LABELS[filterType].label}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupsWithSuggestion.map((g) => (
            <DuplicateGroupCard
              key={g.key}
              group={g}
              toDelete={toDelete}
              onToggleDelete={toggleDelete}
              onSelectSuggested={selectSuggestedToDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({
  group,
  toDelete,
  onToggleDelete,
  onSelectSuggested,
}: {
  group: DuplicateGroup;
  toDelete: Set<string>;
  onToggleDelete: (id: string) => void;
  onSelectSuggested: (g: DuplicateGroup) => void;
}) {
  const reasonMeta = REASON_LABELS[group.reasonType];
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${reasonMeta.color}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{reasonMeta.icon}</span>
          <span className="font-semibold">{reasonMeta.label}</span>
          <span className="text-sm opacity-75">·</span>
          <span className="text-sm opacity-75">{group.reason}</span>
        </div>
        <button
          onClick={() => onSelectSuggested(group)}
          className="text-xs px-2 py-1 rounded bg-white/60 hover:bg-white/80 transition-colors"
          title="Marca para borrar todas las que no tienen la sugerencia de conservar"
        >
          Marcar para borrar (sugerencia)
        </button>
      </div>

      {/* Lista de carreras */}
      <div className="divide-y divide-gray-100">
        {group.races.map((r) => (
          <RaceRow
            key={r._id}
            race={r}
            isMarkedToDelete={toDelete.has(r._id)}
            onToggleDelete={() => onToggleDelete(r._id)}
          />
        ))}
      </div>
    </div>
  );
}

function RaceRow({
  race,
  isMarkedToDelete,
  onToggleDelete,
}: {
  race: RaceSummary;
  isMarkedToDelete: boolean;
  onToggleDelete: () => void;
}) {
  return (
    <div
      className={`p-4 flex items-start gap-4 transition-colors ${
        isMarkedToDelete ? "bg-red-50" : race.keepSuggestion ? "bg-green-50/40" : "bg-white"
      }`}
    >
      {/* Checkbox */}
      <div className="pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isMarkedToDelete}
            onChange={onToggleDelete}
            className="h-4 w-4 rounded border-gray-300 text-runner-primary focus:ring-runner-primary"
          />
          <span className="text-xs text-gray-500">Borrar</span>
        </label>
      </div>

      {/* Datos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-gray-900">{race.name}</h3>
          {race.keepSuggestion && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-200 text-green-800 font-medium">
              ✓ recomendado mantener
            </span>
          )}
          {isMarkedToDelete && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-medium">
              ✗ marcado para borrar
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {race.startDate ?? "?"} {race.startTime && `· ${race.startTime}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {race.locality ?? "?"} {race.province && `(${race.province})`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            {race.distanceKm} km
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 rounded bg-gray-100">
            <strong>{race.fieldsCount}</strong> campos
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 rounded bg-gray-100 text-gray-500">
            {race.scraperAdapter ?? "manual"}
          </span>
          {race.extractedAt && (
            <span className="inline-flex items-center gap-1 text-green-600">
              ✓ extraída
            </span>
          )}
        </div>

        {race.organizer && (
          <div className="text-xs text-gray-700 mt-1">
            <strong>Organiza:</strong> {race.organizer}
            {race.organizerUrl && (
              <a href={race.organizerUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-runner-primary hover:underline inline-flex items-center gap-0.5">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {race.address && (
          <div className="text-xs text-gray-500 mt-0.5">📍 {race.address}</div>
        )}

        {race.officialUrl && (
          <a
            href={race.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-runner-primary hover:underline mt-1 inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            {race.officialUrl.length > 60 ? race.officialUrl.slice(0, 60) + "…" : race.officialUrl}
          </a>
        )}

        {!race.officialUrl && !race.organizer && (
          <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sin organizer ni URL oficial (probablemente un registro esquelético)
          </div>
        )}
      </div>
    </div>
  );
}
