// =============================================================================
// mi-dorsal — /admin/club-suggestions
// =============================================================================
// Lista de clubes que los usuarios no encontraron en la lista RFEA y
// reportaron desde el selector de /perfil. El admin puede:
//   - Ver el detalle (nombre, CCAA, nota, usuario)
//   - Cambiar el estado: new → added | duplicate | rejected
//   - Añadir una nota interna
//
// Patrón visual copiado de /admin/feedback (StatCard, layout, filtros
// pill, lista con detail panel). Misma estética, distinto dominio.
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  Search,
  Loader2,
  Check,
  CheckCircle2,
  Copy,
  XCircle,
  AlertCircle,
  User as UserIcon,
  Mail,
  Clock,
  ExternalLink,
  MapPin,
} from "lucide-react";

type SuggestionStatus = "new" | "added" | "duplicate" | "rejected";

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: "Pendiente",
  added: "Añadido",
  duplicate: "Duplicado",
  rejected: "Rechazado",
};
const STATUS_COLOR: Record<SuggestionStatus, string> = {
  new: "bg-amber-100 text-amber-700 border-amber-200",
  added: "bg-green-100 text-green-700 border-green-200",
  duplicate: "bg-gray-100 text-gray-700 border-gray-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: "gray" | "amber" | "green" | "red";
}) {
  const colorMap: Record<string, string> = {
    gray: "text-gray-500",
    amber: "text-amber-500",
    green: "text-green-500",
    red: "text-red-500",
  };
  return (
    <div className="bg-white border rounded-lg p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </div>
      <Icon className={`h-6 w-6 ${colorMap[color]}`} />
    </div>
  );
}

function MockClubSuggestions() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Sugerencias de clubes</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Clubes que los usuarios no encontraron en la lista RFEA.
      </p>
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — la gestión de sugerencias no está disponible. Conecta con Convex.
      </div>
    </div>
  );
}

function RealClubSuggestions() {
  const [statusFilter, setStatusFilter] = useState<"all" | SuggestionStatus>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery(api.clubSuggestions.adminList, {
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 200,
  });
  const stats = useQuery(api.clubSuggestions.adminGetStats, {});
  const updateStatus = useMutation(api.clubSuggestions.adminUpdateStatus);

  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Sincronizar adminNote con el detail seleccionado. Solo cuando cambia
  // el selectedId, para evitar bucles (React #301).
  useEffect(() => {
    if (selectedId === null) {
      setAdminNote("");
      return;
    }
    const found = list?.find((s) => s._id === selectedId);
    if (found?.adminNote) setAdminNote(found.adminNote);
  }, [selectedId, list]);

  const selected = list?.find((s) => s._id === selectedId) ?? null;

  const handleStatusChange = async (newStatus: SuggestionStatus) => {
    if (!selectedId) return;
    await updateStatus({ id: selectedId as any, status: newStatus });
  };

  const handleSaveNote = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateStatus({ id: selectedId as any, adminNote });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Sugerencias de clubes</h1>
          <p className="text-gray-600 text-sm">
            Clubes que los usuarios no encontraron en la lista RFEA.
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={Search} color="gray" />
          <StatCard label="Pendientes" value={stats.new} icon={AlertCircle} color="amber" />
          <StatCard label="Añadidos" value={stats.added} icon={CheckCircle2} color="green" />
          <StatCard label="Duplicados" value={stats.duplicate} icon={Copy} color="gray" />
          <StatCard label="Rechazados" value={stats.rejected} icon={XCircle} color="red" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista */}
        <div>
          {/* Filtros */}
          <div className="bg-white rounded-lg border p-3 mb-3">
            <div className="flex flex-wrap gap-1.5">
              {(["all", "new", "added", "duplicate", "rejected"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? "bg-runner-primary text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {s === "all" ? "Todos" : STATUS_LABEL[s as SuggestionStatus]}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-lg border overflow-hidden">
            {list === undefined ? (
              <div className="p-8 text-center text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : list.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                {statusFilter === "new"
                  ? "🎉 No hay sugerencias nuevas."
                  : "No hay sugerencias con este filtro."}
              </div>
            ) : (
              <ul className="divide-y max-h-[600px] overflow-y-auto">
                {list.map((s) => {
                  const isSelected = s._id === selectedId;
                  return (
                    <li key={s._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s._id)}
                        className={`w-full text-left p-3 hover:bg-runner-warm transition-colors ${
                          isSelected ? "bg-runner-warm" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate">{s.clubName}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              {s.ccaa && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {s.ccaa}
                                </span>
                              )}
                              <span>·</span>
                              <span>{new Date(s.createdAt).toLocaleDateString("es-ES")}</span>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide flex-shrink-0 ${
                              STATUS_COLOR[s.status as SuggestionStatus]
                            }`}
                          >
                            {STATUS_LABEL[s.status as SuggestionStatus]}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <div className="bg-white rounded-lg border p-5 space-y-4 sticky top-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Club</div>
                <div className="text-xl font-bold">{selected.clubName}</div>
                {selected.ccaa && (
                  <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {selected.ccaa}
                  </div>
                )}
              </div>

              {selected.note && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nota del usuario</div>
                  <p className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">
                    {selected.note}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Enviado</div>
                  <div className="flex items-center gap-1 text-gray-700">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(selected.createdAt).toLocaleString("es-ES")}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Usuario</div>
                  {selected.user ? (
                    <a
                      href={`/admin/users/${selected.user._id}`}
                      className="text-runner-primary hover:underline flex items-center gap-1"
                    >
                      <UserIcon className="h-3.5 w-3.5" />
                      {selected.user.displayName ?? "Sin nombre"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">Anónimo</span>
                  )}
                </div>
                {selected.contactEmail && (
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Contacto</div>
                    <a
                      href={`mailto:${selected.contactEmail}`}
                      className="text-runner-primary hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {selected.contactEmail}
                    </a>
                  </div>
                )}
              </div>

              {/* Cambiar estado */}
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Estado</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["new", "added", "duplicate", "rejected"] as const).map((st) => {
                    const isCurrent = selected.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(st)}
                        disabled={isCurrent}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                          isCurrent
                            ? STATUS_COLOR[st] + " cursor-default"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nota interna del admin */}
              <div>
                <label htmlFor="cs-note" className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                  Nota interna
                </label>
                <textarea
                  id="cs-note"
                  rows={2}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ej. añadido al próximo ingest, era un duplicado de X, etc."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={saving}
                  className="mt-2 btn-secondary text-xs flex items-center gap-1"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Guardar nota
                </button>
              </div>

              {selected.reviewedAt && (
                <div className="text-xs text-gray-400 italic border-t pt-3">
                  Revisado el {new Date(selected.reviewedAt).toLocaleString("es-ES")}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
              Selecciona una sugerencia de la lista para ver el detalle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClubSuggestionsAdminPage() {
  return isMockMode() ? <MockClubSuggestions /> : <RealClubSuggestions />;
}
