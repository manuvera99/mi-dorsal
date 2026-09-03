"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { Database, Loader2, RefreshCw, AlertCircle, CheckCircle2, Pause, Play, Clock, Zap, Hash, Plus, Wand2 } from "lucide-react";

function MockSources() {
  return (
    <div className="p-8">
      <Header />
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — gestión de fuentes no disponible.
      </div>
    </div>
  );
}

function RealSources() {
  const sources = useQuery(api.dataSources.list);
  const seed = useMutation(api.dataSources.seedDefaults);
  const setStatus = useMutation(api.dataSources.setStatus);
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<{ source: string; message: string; ok: boolean } | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seed({});
      setSyncLog({
        source: "seed",
        message: `Seed completado: ${res.filter((r: any) => r.created).length} creadas, ${res.filter((r: any) => !r.created).length} ya existían`,
        ok: true,
      });
    } catch (e: any) {
      setSyncLog({ source: "seed", message: e.message, ok: false });
    } finally {
      setSeeding(false);
    }
  };

  const handleSync = async (slug: string) => {
    setSyncing(slug);
    setSyncLog(null);
    try {
      const res = await fetch(`/api/scrape/${slug}`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSyncLog({
          source: slug,
          message: `Sincronización iniciada (PID ${data.pid}). Esto puede tardar varios minutos. Recarga en 30 seg.`,
          ok: true,
        });
      } else {
        setSyncLog({ source: slug, message: data.error || "Error desconocido", ok: false });
      }
    } catch (e: any) {
      setSyncLog({ source: slug, message: e.message, ok: false });
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleStatus = async (id: any, currentStatus: string) => {
    const newStatus = currentStatus === "paused" ? "active" : "paused";
    await setStatus({ id, status: newStatus });
  };

  return (
    <div className="p-8">
      <Header />

      {sources === undefined ? (
        <div className="p-12 text-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center">
          <Database className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h2 className="text-lg font-semibold mb-2">No hay fuentes de datos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Crea las 5 fuentes estándar (RFEA, FEDME, ITRA, Sportmaniacs, Runedia) con un click.
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {seeding ? "Creando…" : "Crear fuentes estándar"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((s) => (
              <SourceCard
                key={s._id}
                source={s}
                onSync={() => handleSync(s.slug)}
                syncing={syncing === s.slug}
                onToggleStatus={() => handleToggleStatus(s._id, s.status)}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="text-xs text-gray-500 hover:text-runner-primary"
            >
              {seeding ? "Re-seeding…" : "↻ Re-seed (idempotente)"}
            </button>
            <button
              onClick={() => handleSync("all")}
              disabled={syncing !== null}
              className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {syncing === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar todas
            </button>
          </div>
        </>
      )}

      {syncLog && (
        <div className={`mt-4 p-3 rounded-md text-sm ${syncLog.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          <strong>{syncLog.source}:</strong> {syncLog.message}
        </div>
      )}

      <DetailsList sources={sources ?? []} />
    </div>
  );
}

function SourceCard({
  source,
  onSync,
  syncing,
  onToggleStatus,
}: {
  source: any;
  onSync: () => void;
  syncing: boolean;
  onToggleStatus: () => void;
}) {
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    paused: "bg-gray-100 text-gray-600",
    error: "bg-red-100 text-red-700",
  };
  const typeLabels: Record<string, string> = {
    scraper: "Scraper",
    api: "API",
    manual: "Manual",
  };
  const lastSync = source.lastSyncAt
    ? new Date(source.lastSyncAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
    : "Nunca";
  const lastDuration = source.lastSyncDurationMs
    ? `${(source.lastSyncDurationMs / 1000).toFixed(1)}s`
    : "—";

  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg">{source.name}</h3>
          <p className="text-xs text-gray-400">slug: {source.slug}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[source.status] ?? "bg-gray-100 text-gray-700"}`}>
            {source.status}
          </span>
          <span className="text-xs text-gray-500">{typeLabels[source.type]}</span>
        </div>
      </div>

      {source.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{source.description}</p>
      )}

      <div className="space-y-1.5 text-xs mb-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Hash className="h-3 w-3" />
          <span><strong>{source.currentRaceCount ?? 0}</strong> carreras en BBDD</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-3 w-3" />
          <span>Último sync: {lastSync} ({lastDuration})</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="h-3 w-3" />
          <span><strong>{source.totalSyncs ?? 0}</strong> sincronizaciones totales</span>
        </div>
        {source.lastSyncError && (
          <div className="flex items-start gap-2 text-red-600 mt-2 p-2 bg-red-50 rounded">
            <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="text-xs">{source.lastSyncError}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {source.type === "scraper" && (
          <button
            onClick={onSync}
            disabled={syncing || source.status === "paused"}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-runner-primary text-white text-sm font-semibold px-3 py-2 rounded hover:opacity-90 disabled:opacity-40"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Sincronizando…" : "Re-sincronizar"}
          </button>
        )}
        {source.type !== "manual" && (
          <button
            onClick={onToggleStatus}
            className="p-2 text-gray-500 hover:text-runner-primary border rounded"
            title={source.status === "paused" ? "Activar" : "Pausar"}
          >
            {source.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function DetailsList({ sources }: { sources: any[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const details = useQuery(
    api.dataSources.get,
    openSlug ? { id: openSlug as any } : "skip",
  );

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold mb-3">Historial de sincronizaciones</h2>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Fuente</th>
              <th className="px-4 py-2 text-left">Último sync</th>
              <th className="px-4 py-2 text-left">Duración</th>
              <th className="px-4 py-2 text-left">Carreras</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sources.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Sin fuentes</td></tr>
            ) : sources.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">
                  {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString("es-ES") : "—"}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {s.lastSyncDurationMs ? `${(s.lastSyncDurationMs / 1000).toFixed(1)}s` : "—"}
                </td>
                <td className="px-4 py-2 text-gray-600">{s.lastSyncRaceCount ?? "—"}</td>
                <td className="px-4 py-2">
                  {s.lastSyncError ? (
                    <span className="text-red-600 text-xs">error</span>
                  ) : s.lastSyncAt ? (
                    <span className="text-green-600 text-xs">ok</span>
                  ) : (
                    <span className="text-gray-400 text-xs">nunca</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setOpenSlug(openSlug === s._id ? null : s._id)}
                    className="text-xs text-runner-primary hover:underline"
                  >
                    {openSlug === s._id ? "Cerrar" : "Ver historial"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {details && (
          <div className="border-t p-4 bg-gray-50">
            <h3 className="text-sm font-semibold mb-2">Últimas 20 sincronizaciones de {details.source.name}</h3>
            {details.history.length === 0 ? (
              <p className="text-xs text-gray-500">Sin historial todavía</p>
            ) : (
              <div className="space-y-1">
                {details.history.map((h: any) => (
                  <div key={h._id} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-gray-500 w-32">
                      {new Date(h.startedAt).toLocaleString("es-ES")}
                    </span>
                    <span className={h.status === "success" ? "text-green-600" : h.status === "error" ? "text-red-600" : "text-gray-600"}>
                      {h.status}
                    </span>
                    {h.durationMs && <span className="text-gray-500">{(h.durationMs / 1000).toFixed(1)}s</span>}
                    {h.raceCount !== undefined && <span className="text-gray-700">{h.raceCount} carreras</span>}
                    {h.error && <span className="text-red-500 truncate max-w-md">{h.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold">Fuentes de datos</h1>
        <p className="text-gray-600 text-sm">Scrapers y APIs que alimentan el catálogo</p>
      </div>
      <Link
        href="/admin/sources/from-url"
        className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
      >
        <Wand2 className="h-4 w-4" />
        Añadir fuente con IA
      </Link>
    </div>
  );
}

export default function AdminSourcesPage() {
  return isMockMode() ? <MockSources /> : <RealSources />;
}
