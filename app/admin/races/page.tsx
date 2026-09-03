"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, MapPin, Calendar } from "lucide-react";
import { PROVINCE_LIST, formatRaceType } from "@/lib/utils";

function MockRacesList() {
  return (
    <div className="p-8">
      <Header />
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-500">Modo mock — gestión de carreras no disponible aquí. Ve a /carreras para ver los datos.</p>
        <Link href="/carreras" className="text-runner-primary hover:underline text-sm mt-2 inline-block">
          Ver catálogo →
        </Link>
      </div>
    </div>
  );
}

function RealRacesList() {
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");
  const [published, setPublished] = useState<"all" | "yes" | "no">("all");
  const [source, setSource] = useState("");
  const useMock = isMockMode();
  const races = useMock ? null : useQuery(api.races.adminList, {
    search: search || undefined,
    province: (province || undefined) as any,
    isPublished: published === "all" ? undefined : published === "yes",
  });
  const sources = useQuery(api.dataSources.listPublic);
  const toggleMutation = useMutation(api.races.adminToggle);
  const deleteMutation = useMutation(api.races.adminDelete);
  const migrateMutation = useMutation(api.dataSources.migrateRacesToSources);

  const handleToggle = async (id: any, field: "isPublished" | "isFeatured", value: boolean) => {
    await toggleMutation({ id, field, value });
  };
  const handleDelete = async (id: any, name: string) => {
    if (confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) {
      await deleteMutation({ id });
    }
  };

  return (
    <div className="p-8">
      <Header />

      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, localidad o slug…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
        >
          <option value="">Todas las provincias</option>
          {PROVINCE_LIST.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={published}
          onChange={(e) => setPublished(e.target.value as any)}
        >
          <option value="all">Todos los estados</option>
          <option value="yes">Publicadas</option>
          <option value="no">Borrador</option>
        </select>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Todas las fuentes</option>
          {sources?.map((s: any) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
        <div className="text-sm text-gray-500 ml-auto">
          {races === undefined || races === null ? "…" : `${races.length} carreras`}
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {races === undefined || races === null ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (() => {
          const filtered = source
            ? races.filter((r: any) => r.dataSourceId === source)
            : races;
          return filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No hay carreras con esos filtros</div>
          ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Carrera</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Distancia</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-center">Pub.</th>
                <th className="px-4 py-3 text-center">Dest.</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const src = (sources ?? []).find((s: any) => s._id === r.dataSourceId);
                return (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {src ? (
                        <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {src.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.locality ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {r.locality}
                        </span>
                      ) : (
                        "—"
                      )}
                      <div className="text-xs text-gray-400 capitalize">{r.province}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.startDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {r.startDate}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.distanceKm ? `${r.distanceKm} km` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatRaceType(r.raceType)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(r._id, "isPublished", !r.isPublished)}
                        className={`inline-block w-3 h-3 rounded-full ${
                          r.isPublished ? "bg-green-500" : "bg-gray-300"
                        }`}
                        title={r.isPublished ? "Publicada" : "Borrador"}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(r._id, "isFeatured", !r.isFeatured)}
                        className={`inline-block w-3 h-3 rounded-full ${
                          r.isFeatured ? "bg-yellow-500" : "bg-gray-300"
                        }`}
                        title={r.isFeatured ? "Destacada" : "Normal"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/races/${r._id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-runner-primary"
                      >
                        <Edit2 className="h-3 w-3" /> Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(r._id, r.name)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          );
        })()}
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          onClick={async () => {
            const res = await migrateMutation({});
            alert(`Migración: ${res.updated} carreras vinculadas a su fuente de ${res.scanned} candidatas`);
          }}
          className="text-xs text-gray-500 hover:text-runner-primary"
        >
          ↻ Vincular carreras existentes a su fuente
        </button>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold">Carreras</h1>
        <p className="text-gray-600 text-sm">Gestiona el catálogo</p>
      </div>
      <Link
        href="/admin/races/new"
        className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Añadir carrera
      </Link>
    </div>
  );
}

export default function AdminRacesPage() {
  return isMockMode() ? <MockRacesList /> : <RealRacesList />;
}
