"use client";
// =============================================================================
// mi-dorsal — /admin/race-suggestions
// =============================================================================
// Lista de carreras que los usuarios han sugerido (porque no las encuentran
// en /carreras). El admin puede:
//   - Abrir la URL para revisarla
//   - Aprobar y abrir el flujo "Crear desde URL" con la URL pre-rellena
//   - Rechazar con nota
//   - Ver la URL original
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  Inbox,
  Loader2,
  ExternalLink,
  Sparkles,
  Check,
  X,
  Clock,
  MapPin,
  User as UserIcon,
  Calendar,
  ArrowRight,
  FileText,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";

type Status = "pending" | "approved" | "rejected" | "created";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  created: "Creada",
};
const STATUS_COLOR: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-gray-100 text-gray-700",
  created: "bg-green-100 text-green-700",
};

function MockSuggestions() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Sugerencias de carreras</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Carreras que los usuarios han pedido añadir al catálogo.
      </p>
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — la gestión de sugerencias no está disponible. Conecta con Convex.
      </div>
    </div>
  );
}

function RealSuggestions() {
  const [status, setStatus] = useState<"all" | Status>("pending");
  const list = useQuery(api.raceSuggestions.adminList, {
    status: status === "all" ? undefined : status,
    limit: 200,
  });
  const stats = useQuery(api.raceSuggestions.adminGetStats, {});
  const updateStatus = useMutation(api.raceSuggestions.adminUpdateStatus);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const startReview = (id: string, a: "approve" | "reject") => {
    setReviewingId(id);
    setAction(a);
    setAdminNote("");
  };
  const cancelReview = () => {
    setReviewingId(null);
    setAction(null);
    setAdminNote("");
  };
  const submitReview = async () => {
    if (!reviewingId || !action) return;
    await updateStatus({
      id: reviewingId as any,
      status: action === "approve" ? "approved" : "rejected",
      adminNote: adminNote.trim() || undefined,
    });
    cancelReview();
  };

  const handleApproveAndCreate = (id: string, url: string) => {
    updateStatus({ id: id as any, status: "approved" }).then(() => {
      // Redirige al "Crear desde URL" con la URL pre-rellena
      window.location.href = `/admin/races/from-url?url=${encodeURIComponent(url)}`;
    });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Sugerencias de carreras</h1>
          <p className="text-gray-600 text-sm">
            Carreras que los usuarios han pedido añadir al catálogo.
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={Inbox} color="gray" size="sm" />
          <StatCard label="Pendientes" value={stats.pending} icon={Clock} color="amber" size="sm" />
          <StatCard label="Aprobadas" value={stats.approved} icon={Check} color="blue" size="sm" />
          <StatCard label="Rechazadas" value={stats.rejected} icon={X} color="gray" size="sm" />
          <StatCard label="Creadas" value={stats.created} icon={Sparkles} color="green" size="sm" />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border p-3 mb-4 flex flex-wrap gap-2 items-center">
        {(["all", "pending", "approved", "rejected", "created"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              status === s
                ? "bg-runner-primary text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {s === "all" ? "Todas" : STATUS_LABEL[s as Status]}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {list === undefined ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {status === "pending"
              ? "🎉 No hay sugerencias pendientes. ¡Buen trabajo!"
              : "No hay sugerencias con este filtro."}
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((s) => {
              const isReviewing = reviewingId === s._id;
              return (
                <li key={s._id} className="p-5 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Cabecera: nombre sugerido + estado */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-runner-dark">
                          {s.suggestedName || "Carrera sin nombre"}
                        </h3>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            STATUS_COLOR[s.status as Status]
                          }`}
                        >
                          {STATUS_LABEL[s.status as Status]}
                        </span>
                      </div>

                      {/* URL */}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-runner-primary hover:underline inline-flex items-center gap-1 break-all"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                        {s.url}
                      </a>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        {s.suggestedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            {s.suggestedDate}
                          </span>
                        )}
                        {s.suggestedLocality && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {s.suggestedLocality}
                            {s.suggestedProvince && ` (${s.suggestedProvince})`}
                          </span>
                        )}
                        {s.user && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" aria-hidden="true" />
                            {s.user.displayName || s.user.email || "Anónimo"}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {new Date(s.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Nota del usuario */}
                      {s.note && (
                        <div className="mt-3 p-3 bg-runner-warm rounded-md border border-gray-200 text-sm text-gray-700">
                          <p className="text-xs text-gray-500 mb-1 font-semibold">Nota del usuario:</p>
                          <p className="whitespace-pre-wrap">{s.note}</p>
                        </div>
                      )}

                      {/* Admin note previa */}
                      {s.adminNote && !isReviewing && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-md text-xs text-gray-600 italic">
                          📝 {s.adminNote}
                        </div>
                      )}

                      {/* Si ya está creada, link a la carrera */}
                      {s.createdRace && (
                        <Link
                          href={`/admin/races/${s.createdRace._id}`}
                          className="mt-2 inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-900 font-semibold"
                        >
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
          Carrera creada: {s.createdRace.name}
                        </Link>
                      )}

                      {/* Form de review */}
                      {isReviewing && (
                        <div className="mt-3 p-3 bg-white border-2 border-runner-primary/30 rounded-md space-y-2">
                          <label className="block text-xs font-semibold text-gray-700">
                            <FileText className="inline h-3.5 w-3.5 mr-0.5" aria-hidden="true" />
                            Nota {action === "reject" ? "(motivo del rechazo, recomendado)" : "(opcional)"}:
                          </label>
                          <textarea
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder={
                              action === "reject"
                                ? "Por qué la rechazamos (ej. 'ya existe como X', 'fuera de scope')…"
                                : "Algo que ayude al admin a localizarla al crear…"
                            }
                            className="w-full px-2 py-1.5 border rounded text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={submitReview}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-white ${
                                action === "approve"
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-red-600 hover:bg-red-700"
                              }`}
                            >
                              {action === "approve" ? "Marcar aprobada" : "Marcar rechazada"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelReview}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    {s.status === "pending" && !isReviewing && (
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveAndCreate(s._id, s.url)}
                          className="inline-flex items-center gap-1.5 bg-runner-primary text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 whitespace-nowrap"
                          title="Aprobar y abrir 'Crear desde URL' con la URL pre-rellena"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Aprobar y crear
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startReview(s._id, "approve")}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                        >
                          <Check className="h-3 w-3" />
                          Aprobar (sin crear)
                        </button>
                        <button
                          type="button"
                          onClick={() => startReview(s._id, "reject")}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2 py-1"
                        >
                          <X className="h-3 w-3" />
                          Rechazar
                        </button>
                      </div>
                    )}
                    {s.status === "approved" && !s.createdRaceId && (
                      <Link
                        href={`/admin/races/from-url?url=${encodeURIComponent(s.url)}`}
                        className="inline-flex items-center gap-1 text-xs text-runner-primary hover:underline whitespace-nowrap"
                      >
                        Crear ahora <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminRaceSuggestionsPage() {
  return isMockMode() ? <MockSuggestions /> : <RealSuggestions />;
}
