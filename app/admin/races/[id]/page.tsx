"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { PROVINCE_LIST } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react";

export default function EditRacePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const useMock = isMockMode();
  const race = useMock ? null : useQuery(api.races.get, { id: id as any });
  const update = useMock ? null : useMutation(api.races.adminUpdate);
  const remove = useMock ? null : useMutation(api.races.adminDelete);

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (race) {
      setForm({
        name: race.name,
        locality: race.locality ?? "",
        province: race.province,
        distanceKm: race.distanceKm,
        elevationGainM: race.elevationGainM ?? 0,
        raceType: race.raceType,
        startDate: race.startDate ?? "",
        startTime: race.startTime ?? "",
        description: race.description ?? "",
        officialUrl: race.officialUrl ?? "",
        registrationUrl: race.registrationUrl ?? "",
        resultsUrl: race.resultsUrl ?? "",
        organizer: race.organizer ?? "",
        isPublished: race.isPublished ?? false,
        isFeatured: race.isFeatured ?? false,
      });
    }
  }, [race]);

  if (useMock) {
    return (
      <div className="p-8">
        <Link href="/admin/races" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">Mock mode — edición no disponible.</div>
      </div>
    );
  }
  if (race === undefined) {
    return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (race === null) {
    return <div className="p-8 text-red-600">Carrera no encontrada</div>;
  }
  if (!form) return null;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!update) throw new Error("update no disponible en mock");
      await update({
        id: id as any,
        patch: {
          name: form.name,
          locality: form.locality || undefined,
          province: form.province,
          distanceKm: Number(form.distanceKm),
          elevationGainM: Number(form.elevationGainM) || undefined,
          raceType: form.raceType,
          startDate: form.startDate || undefined,
          startTime: form.startTime || undefined,
          description: form.description || undefined,
          officialUrl: form.officialUrl || undefined,
          registrationUrl: form.registrationUrl || undefined,
          resultsUrl: form.resultsUrl || undefined,
          organizer: form.organizer || undefined,
          isPublished: form.isPublished,
          isFeatured: form.isFeatured,
        },
      });
      router.push("/admin/races");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (confirm(`¿Eliminar "${form.name}"?`)) {
      if (!remove) return;
      await remove({ id: id as any });
      router.push("/admin/races");
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/admin/races" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Volver a carreras
      </Link>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Editar carrera</h1>
        <button onClick={handleDelete} className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm">
          <Trash2 className="h-4 w-4" /> Eliminar
        </button>
      </div>
      <p className="text-gray-600 mb-6 text-sm">Slug: <code className="bg-gray-100 px-1 rounded">{race.slug}</code> (se regenera si cambias el nombre)</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">{error}</div>}

      <form onSubmit={submit} className="bg-white border rounded-lg p-6 space-y-5">
        <Field label="Nombre *">
          <input type="text" required value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Localidad">
            <input type="text" value={form.locality} onChange={(e) => set("locality", e.target.value)} className="input" />
          </Field>
          <Field label="Provincia *">
            <select required value={form.province} onChange={(e) => set("province", e.target.value)} className="input">
              {PROVINCE_LIST.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Distancia (km) *">
            <input type="number" step="0.1" min="0" required value={form.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} className="input" />
          </Field>
          <Field label="Desnivel (m)">
            <input type="number" min="0" value={form.elevationGainM} onChange={(e) => set("elevationGainM", e.target.value)} className="input" />
          </Field>
          <Field label="Tipo *">
            <select value={form.raceType} onChange={(e) => set("raceType", e.target.value)} className="input">
              <option value="road">Asfalto</option>
              <option value="trail">Trail</option>
              <option value="mixed">Mixta</option>
              <option value="obstacle">Obstáculos</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha">
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="input" />
          </Field>
          <Field label="Hora">
            <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input min-h-[80px]" />
        </Field>
        <Field label="Organizador">
          <input type="text" value={form.organizer} onChange={(e) => set("organizer", e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Web oficial">
            <input type="url" value={form.officialUrl} onChange={(e) => set("officialUrl", e.target.value)} className="input" />
          </Field>
          <Field label="URL inscripción">
            <input type="url" value={form.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} className="input" />
          </Field>
          <Field label="URL resultados">
            <input type="url" value={form.resultsUrl} onChange={(e) => set("resultsUrl", e.target.value)} className="input" />
          </Field>
        </div>
        <div className="flex items-center gap-6 pt-2 border-t">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} className="h-4 w-4" />
            Publicada
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="h-4 w-4" />
            Destacada
          </label>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </button>
          <Link href="/admin/races" className="text-sm text-gray-500 hover:underline">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
