// =============================================================================
// mi-dorsal — /admin/feedback
// =============================================================================
// Lista de feedback y bug reports enviados por los usuarios desde /feedback.
// El admin puede:
//   - Ver el detalle (tipo, descripción, página, usuario)
//   - Cambiar el estado: new → in_progress → done | wontfix
//   - Añadir notas internas
// =============================================================================

"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Loader2,
  ExternalLink,
  Check,
  X,
  Clock,
  User as UserIcon,
  Mail,
  AlertCircle,
  CheckCircle2,
  Eye,
} from "lucide-react";

type FeedbackType = "bug" | "idea" | "feedback";
type FeedbackStatus = "new" | "in_progress" | "done" | "wontfix";

const TYPE_LABEL: Record<FeedbackType, { label: string; emoji: string; color: string }> = {
  bug: { label: "Bug", emoji: "🐛", color: "bg-red-100 text-red-700" },
  idea: { label: "Idea", emoji: "💡", color: "bg-green-100 text-green-700" },
  feedback: { label: "Feedback", emoji: "💬", color: "bg-cyan-100 text-cyan-700" },
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Nuevo",
  in_progress: "En progreso",
  done: "Resuelto",
  wontfix: "No se hará",
};
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  new: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  wontfix: "bg-gray-100 text-gray-700",
};

function MockFeedback() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Feedback</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Bugs, ideas y comentarios enviados por los usuarios.
      </p>
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — la gestión de feedback no está disponible. Conecta con Convex.
      </div>
    </div>
  );
}

function RealFeedback() {
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("new");
  const [typeFilter, setTypeFilter] = useState<"all" | FeedbackType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery(api.feedback.adminList, {
    status: statusFilter === "all" ? undefined : statusFilter,
    type: typeFilter === "all" ? undefined : typeFilter,
    limit: 200,
  });
  const stats = useQuery(api.feedback.adminGetStats, {});
  const detail = useQuery(
    api.feedback.adminGet,
    selectedId ? { id: selectedId as any } : "skip"
  );
  const updateStatus = useMutation(api.feedback.adminUpdateStatus);

  const [adminNote, setAdminNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Sincronizar nota local con la del detail (solo cuando cambia el selectedId
  // o el detail se carga por primera vez). Si lo hiciéramos en el render body
  // se produce el React error #301 (bucle infinito de setState).
  useEffect(() => {
    if (selectedId === null) {
      setAdminNote("");
    } else if (detail?.adminNote) {
      setAdminNote(detail.adminNote);
    }
  }, [selectedId, detail?._id, detail?.adminNote]);

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (!selectedId) return;
    await updateStatus({ id: selectedId as any, status: newStatus });
  };

  const handleSaveNote = async () => {
    if (!selectedId) return;
    setSavingNote(true);
    try {
      await updateStatus({ id: selectedId as any, adminNote });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Feedback</h1>
          <p className="text-gray-600 text-sm">
            Bugs, ideas y comentarios enviados desde el formulario público.
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={MessageSquare} color="gray" />
          <StatCard label="Nuevos" value={stats.new} icon={AlertCircle} color="amber" />
          <StatCard label="En progreso" value={stats.inProgress} icon={Clock} color="blue" />
          <StatCard label="Resueltos" value={stats.done} icon={CheckCircle2} color="green" />
          <StatCard label="No se hará" value={stats.wontfix} icon={X} color="gray" />
        </div>
      )}

      {stats && (
        <div className="bg-white border rounded-lg p-3 mb-4 text-sm text-gray-600 flex flex-wrap gap-4">
          <span>
            <strong>Por tipo:</strong>{" "}
            🐛 {stats.byType.bug} bugs · 💡 {stats.byType.idea} ideas · 💬 {stats.byType.feedback} feedback
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista */}
        <div>
          {/* Filtros */}
          <div className="bg-white rounded-lg border p-3 mb-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {(["all", "new", "in_progress", "done", "wontfix"] as const).map((s) => (
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
                  {s === "all" ? "Todos" : STATUS_LABEL[s as FeedbackStatus]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "bug", "idea", "feedback"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    typeFilter === t
                      ? "bg-gray-800 text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {t === "all" ? "Todos los tipos" : `${TYPE_LABEL[t as FeedbackType].emoji} ${TYPE_LABEL[t as FeedbackType].label}`}
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
                  ? "🎉 No hay feedback nuevo. ¡Buen trabajo!"
                  : "No hay feedback con este filtro."}
              </div>
            ) : (
              <ul className="divide-y max-h-[600px] overflow-y-auto">
                {list.map((r) => {
                  const typeInfo = TYPE_LABEL[r.type as FeedbackType];
                  return (
                    <li key={r._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r._id)}
                        className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                          selectedId === r._id ? "bg-runner-primary/5 border-l-4 border-runner-primary" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${typeInfo.color}`}>
                            {typeInfo.emoji} {typeInfo.label}
                          </span>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-full text-xs ${
                              STATUS_COLOR[r.status as FeedbackStatus]
                            }`}
                          >
                            {STATUS_LABEL[r.status as FeedbackStatus]}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-runner-dark line-clamp-2">{r.title}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.description}</p>
                        {r.race && (
                          <p className="text-xs mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                              🏁 {r.race.name}
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {r.user?.displayName || r.user?.email || r.contactEmail || "Anónimo"} ·{" "}
                          {new Date(r.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div>
          {!selectedId ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
              <Eye className="h-8 w-8 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm">Selecciona un feedback para ver el detalle</p>
            </div>
          ) : detail === undefined ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : detail === null ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
              No encontrado
            </div>
          ) : (
            <div className="bg-white border rounded-lg p-5 space-y-4">
              {/* Cabecera */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_LABEL[detail.type as FeedbackType].color}`}>
                    {TYPE_LABEL[detail.type as FeedbackType].emoji} {TYPE_LABEL[detail.type as FeedbackType].label}
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[detail.status as FeedbackStatus]}`}>
                    {STATUS_LABEL[detail.status as FeedbackStatus]}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-runner-dark">{detail.title}</h2>
              </div>

              {/* Meta */}
              <div className="space-y-1 text-xs text-gray-600">
                {detail.user ? (
                  <p className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3" aria-hidden="true" />
                    {detail.user.displayName || detail.user.email}
                    {detail.user.email && (
                      <a
                        href={`mailto:${detail.user.email}`}
                        className="text-runner-primary hover:underline ml-1"
                      >
                        <Mail className="h-3 w-3 inline" aria-hidden="true" />
                      </a>
                    )}
                  </p>
                ) : detail.contactEmail ? (
                  <p className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3" aria-hidden="true" />
                    Anónimo · {detail.contactEmail}
                    <a
                      href={`mailto:${detail.contactEmail}`}
                      className="text-runner-primary hover:underline"
                    >
                      <Mail className="h-3 w-3 inline" aria-hidden="true" />
                    </a>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3" aria-hidden="true" />
                    Anónimo (sin email)
                  </p>
                )}
                {detail.race && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-xs text-amber-800 font-semibold mb-1">🏁 Carrera asociada</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <a
                        href={`/carreras/${detail.race.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-runner-dark hover:text-runner-primary font-semibold"
                      >
                        {detail.race.name}
                      </a>
                      <a
                        href={`/admin/races/${detail.race._id}`}
                        className="text-runner-primary hover:underline"
                      >
                        editar →
                      </a>
                    </div>
                  </div>
                )}
                {detail.pageUrl && (
                  <p className="flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <a
                      href={detail.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-runner-primary hover:underline truncate"
                    >
                      {detail.pageUrl}
                    </a>
                  </p>
                )}
                <p className="text-gray-400">
                  Enviado el{" "}
                  {new Date(detail.createdAt).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* Descripción */}
              <div className="p-3 bg-runner-warm rounded-md border border-gray-200">
                <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                <div className="flex flex-wrap gap-1.5">
                  {(["new", "in_progress", "done", "wontfix"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        detail.status === s
                          ? "bg-runner-primary text-white"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nota admin */}
              <div>
                <label htmlFor="admin-note" className="block text-xs font-semibold text-gray-700 mb-1">
                  Nota interna (no se muestra al usuario)
                </label>
                <textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Tus pensamientos, contexto interno, próximos pasos…"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-runner-primary/20 focus:border-runner-primary resize-y"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">{adminNote.length}/2000</p>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={savingNote || adminNote === (detail.adminNote ?? "")}
                    className="text-xs text-runner-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingNote ? "Guardando…" : "Guardar nota"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: "gray" | "amber" | "blue" | "green";
}) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
  };
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`p-1 rounded ${colors[color]}`}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function AdminFeedbackPage() {
  return isMockMode() ? <MockFeedback /> : <RealFeedback />;
}
