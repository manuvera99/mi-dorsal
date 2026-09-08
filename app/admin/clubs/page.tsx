// =============================================================================
// mi-dorsal — /admin/clubs
// =============================================================================
// CRUD de clubs manuales (clubsCatalog en Convex). El admin puede:
//   - Ver la lista de clubs manuales con búsqueda
//   - Añadir uno nuevo (form con name + CCAA)
//   - Editar nombre / CCAA / isActive
//   - Eliminar (soft delete: isActive=false)
//
// Los clubs que vienen de la RFEA están en lib/data/clubs.json (estático)
// y NO aparecen aquí — son la base. Aquí solo se gestionan los añadidos.
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  Building2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Edit3,
  X,
  Check,
  Sparkles,
  Inbox,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const CCAA_OPTIONS = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Islas Baleares",
  "Canarias",
  "Cantabria",
  "Castilla y León",
  "Castilla-La Mancha",
  "Cataluña",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "País Vasco",
  "Ceuta",
  "Melilla",
  "Sin CCAA",
];

const SOURCE_LABEL = {
  manual: { label: "Manual", color: "bg-blue-100 text-blue-700", icon: Plus },
  from_suggestion: { label: "Sugerencia", color: "bg-amber-100 text-amber-700", icon: Inbox },
} as const;

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    gray: "text-gray-500",
    blue: "text-blue-500",
    amber: "text-amber-500",
    green: "text-green-500",
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

function MockAdminClubs() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Clubes manuales</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Clubs añadidos por el admin. La base RFEA está en clubs.json (estático).
      </p>
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — la gestión de clubes no está disponible. Conecta con Convex.
      </div>
    </div>
  );
}

type ClubFormData = {
  name: string;
  ccaa: string;
};

function RealAdminClubs() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "from_suggestion">("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useQuery(api.clubsCatalog.adminList, {
    search: search || undefined,
    source: sourceFilter === "all" ? undefined : sourceFilter,
    activeOnly,
    limit: 200,
  });
  const stats = useQuery(api.clubsCatalog.adminGetStats, {});
  const createClub = useMutation(api.clubsCatalog.adminCreate);
  const updateClub = useMutation(api.clubsCatalog.adminUpdate);
  const deleteClub = useMutation(api.clubsCatalog.adminDelete);

  const handleCreate = async (data: ClubFormData) => {
    await createClub({ name: data.name, ccaa: data.ccaa });
    setShowAddForm(false);
  };

  const handleUpdate = async (id: string, data: Partial<ClubFormData & { isActive: boolean }>) => {
    await updateClub({
      id: id as any,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.ccaa !== undefined && { ccaa: data.ccaa }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? El club se desactivará (soft delete). Si vino de una sugerencia, se marcará como rechazada.`)) {
      return;
    }
    await deleteClub({ id: id as any });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Clubes manuales</h1>
          <p className="text-gray-600 text-sm">
            Clubs añadidos por el admin. La base RFEA está en <code className="text-xs bg-gray-100 px-1 rounded">lib/data/clubs.json</code> (estático).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Añadir club
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={Building2} color="gray" />
          <StatCard label="Activos" value={stats.active} icon={Sparkles} color="green" />
          <StatCard label="Manuales" value={stats.manual} icon={Plus} color="blue" />
          <StatCard label="Desde sugerencia" value={stats.fromSuggestion} icon={Inbox} color="amber" />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border p-3 mb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o CCAA…"
              className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "manual", "from_suggestion"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSourceFilter(s)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  sourceFilter === s
                    ? "bg-runner-primary text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "Todos" : SOURCE_LABEL[s].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActiveOnly(!activeOnly)}
            className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1"
          >
            {activeOnly ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {activeOnly ? "Solo activos" : "Todos"}
          </button>
        </div>
      </div>

      {/* Form de crear */}
      {showAddForm && (
        <ClubForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Lista */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {list === undefined ? (
          <div className="p-8 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {search || sourceFilter !== "all"
              ? "No hay clubs con esos filtros."
              : "🎉 No hay clubs manuales. La base RFEA cubre el resto."}
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((c) => {
              const isEditing = editingId === c._id;
              const sourceInfo = SOURCE_LABEL[c.source as keyof typeof SOURCE_LABEL];
              const SourceIcon = sourceInfo.icon;
              return (
                <li key={c._id} className="p-3">
                  {isEditing ? (
                    <ClubForm
                      mode="edit"
                      initial={{ name: c.name, ccaa: c.ccaa, isActive: c.isActive !== false }}
                      onSubmit={async (data) => {
                        await handleUpdate(c._id, data);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{c.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${sourceInfo.color} flex items-center gap-1`}>
                            <SourceIcon className="h-3 w-3" />
                            {sourceInfo.label}
                          </span>
                          {c.isActive === false && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold uppercase tracking-wide">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.ccaa}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingId(c._id)}
                          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                          aria-label="Editar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c._id, c.name)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ClubForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: ClubFormData & { isActive?: boolean };
  onSubmit: (data: ClubFormData & { isActive?: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ccaa, setCcaa] = useState(initial?.ccaa ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedCcaa = ccaa.trim();
    if (trimmedName.length < 2) {
      setError("El nombre es demasiado corto.");
      return;
    }
    if (trimmedCcaa.length < 2) {
      setError("La CCAA es requerida.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: trimmedName, ccaa: trimmedCcaa, isActive });
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-3 rounded-md space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Club Atletismo Bull Runners"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CCAA</label>
          <select
            value={ccaa}
            onChange={(e) => setCcaa(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
          >
            <option value="">— Selecciona —</option>
            {CCAA_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded"
          />
          <span>Activo (aparece en el selector)</span>
        </label>
      )}
      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-runner-primary text-white rounded-md hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {mode === "create" ? "Crear" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

export default function AdminClubsPage() {
  return isMockMode() ? <MockAdminClubs /> : <RealAdminClubs />;
}
