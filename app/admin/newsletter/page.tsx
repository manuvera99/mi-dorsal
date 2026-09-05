// =============================================================================
// mi-dorsal — /admin/newsletter (gestión de suscriptores)
// =============================================================================
// Lista suscriptores con filtros, muestra stats y permite acciones manuales
// (importar CSV, desuscribir manualmente).
// =============================================================================

"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { Search, Loader2, UserMinus, Upload, BarChart3, Check, Clock, X } from "lucide-react";

export default function AdminNewsletterPage() {
  if (isMockMode()) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Newsletter</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Suscriptores externos a mi-dorsal (doble opt-in).
        </p>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Modo mock — gestión de newsletter no disponible. Conecta con Convex.
        </div>
      </div>
    );
  }

  const [status, setStatus] = useState<"all" | "pending" | "active" | "unsubscribed" | "bounced">("all");
  const [search, setSearch] = useState("");

  const subs = useQuery(api.newsletter.adminList, {
    status: status === "all" ? undefined : status,
    search: search || undefined,
    limit: 200,
  });
  const stats = useQuery(api.newsletter.adminGetStats, {});
  const unsubscribe = useMutation(api.newsletter.unsubscribeByEmail);

  const handleUnsubscribe = async (email: string) => {
    const reason = prompt(`¿Desuscribir a ${email}? Escribe el motivo (opcional):`);
    if (reason === null) return; // cancel
    await unsubscribe({ email, reason: reason || undefined });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Newsletter</h1>
          <p className="text-gray-600 text-sm">
            Suscriptores externos a mi-dorsal (doble opt-in RGPD).
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Total"
            value={stats.total}
            icon={BarChart3}
            color="gray"
          />
          <StatCard
            label="Activos"
            value={stats.active}
            icon={Check}
            color="green"
          />
          <StatCard
            label="Pendientes"
            value={stats.pending}
            icon={Clock}
            color="amber"
          />
          <StatCard
            label="Dados de baja"
            value={stats.unsubscribed}
            icon={UserMinus}
            color="gray"
          />
          <StatCard
            label="Rebotados"
            value={stats.bounced}
            icon={X}
            color="red"
          />
        </div>
      )}

      {stats && (
        <div className="bg-white border rounded-lg p-4 mb-4 text-sm text-gray-600">
          <p>
            <strong className="text-gray-900">Tasa de conversión (pending → active):</strong>{" "}
            {stats.conversionRate}%
          </p>
          <p className="mt-1">
            <strong className="text-gray-900">Fuentes de los activos:</strong>{" "}
            {Object.entries(stats.sources)
              .filter(([, n]) => (n as number) > 0)
              .map(([src, n]) => `${src}: ${n}`)
              .join(" · ") || "—"}
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por email…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="pending">Pendientes</option>
          <option value="unsubscribed">Dados de baja</option>
          <option value="bounced">Rebotados</option>
        </select>
        <div className="text-sm text-gray-500 ml-auto">
          {subs === undefined ? "…" : `${subs.length} suscriptores`}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {subs === undefined ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : subs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No hay suscriptores con esos filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Preferencias</th>
                <th className="px-4 py-3">Suscrito</th>
                <th className="px-4 py-3">Último envío</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subs.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{s.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.source}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {[
                      s.preferences.editorialEnabled && "Editorial",
                      s.preferences.raceRemindersEnabled && "Recordatorios",
                      s.preferences.resultsEnabled && "Resultados",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(s.subscribedAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {s.lastSentAt
                      ? new Date(s.lastSentAt).toLocaleDateString("es-ES")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status !== "unsubscribed" && (
                      <button
                        onClick={() => handleUnsubscribe(s.email)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Dar de baja
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-800", label: "Pendiente" },
    active: { bg: "bg-green-100", text: "text-green-800", label: "Activo" },
    unsubscribed: { bg: "bg-gray-100", text: "text-gray-600", label: "Baja" },
    bounced: { bg: "bg-red-100", text: "text-red-800", label: "Rebotado" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${s.bg} ${s.text}`}>{s.label}</span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: "gray" | "green" | "amber" | "red";
}) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className={`inline-flex p-1.5 rounded ${colors[color]} mb-2`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}
