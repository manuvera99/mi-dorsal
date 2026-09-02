"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { PROVINCE_LIST } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

export default function NewRacePage() {
  const router = useRouter();
  const useMock = isMockMode();
  const create = useMutation(api.races.create);

  const [form, setForm] = useState({
    name: "",
    locality: "",
    province: "valencia" as any,
    distanceKm: 10,
    elevationGainM: 0,
    raceType: "road" as "road" | "trail" | "mixed" | "obstacle",
    startDate: "",
    startTime: "09:00",
    description: "",
    officialUrl: "",
    registrationUrl: "",
    resultsUrl: "",
    organizer: "",
    isPublished: true,
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (useMock) {
    return (
      <div className="p-8">
        <Link href="/admin/races" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
        <h1 className="text-3xl font-bold mb-2">Nueva carrera</h1>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Modo mock — creación de carreras no disponible. Conecta con Convex para usar el formulario.
        </div>
      </div>
    );
  }

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const id = await create({
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
      });
      router.push(`/admin/races/${id}`);
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/admin/races" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Volver a carreras
      </Link>
      <h1 className="text-3xl font-bold mb-2">Nueva carrera</h1>
      <p className="text-gray-600 mb-6 text-sm">Crea una carrera manualmente. Se publica inmediatamente si marcas "Publicada".</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="bg-white border rounded-lg p-6 space-y-5">
        <Field label="Nombre *">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="input"
            placeholder="15K Nocturna Valencia Gana Energía"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Localidad">
            <input
              type="text"
              value={form.locality}
              onChange={(e) => set("locality", e.target.value)}
              className="input"
              placeholder="Valencia"
            />
          </Field>
          <Field label="Provincia *">
            <select
              required
              value={form.province}
              onChange={(e) => set("province", e.target.value as any)}
              className="input"
            >
              {PROVINCE_LIST.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Distancia (km) *">
            <input
              type="number"
              step="0.1"
              min="0"
              required
              value={form.distanceKm}
              onChange={(e) => set("distanceKm", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Desnivel (m)">
            <input
              type="number"
              min="0"
              value={form.elevationGainM}
              onChange={(e) => set("elevationGainM", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Tipo *">
            <select
              value={form.raceType}
              onChange={(e) => set("raceType", e.target.value as any)}
              className="input"
            >
              <option value="road">Asfalto</option>
              <option value="trail">Trail</option>
              <option value="mixed">Mixta</option>
              <option value="obstacle">Obstáculos</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha (YYYY-MM-DD)">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Hora (HH:MM)">
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Descripción">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="input min-h-[80px]"
          />
        </Field>

        <Field label="Organizador">
          <input
            type="text"
            value={form.organizer}
            onChange={(e) => set("organizer", e.target.value)}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Web oficial">
            <input
              type="url"
              value={form.officialUrl}
              onChange={(e) => set("officialUrl", e.target.value)}
              className="input"
              placeholder="https://…"
            />
          </Field>
          <Field label="URL inscripción">
            <input
              type="url"
              value={form.registrationUrl}
              onChange={(e) => set("registrationUrl", e.target.value)}
              className="input"
              placeholder="https://…"
            />
          </Field>
          <Field label="URL resultados">
            <input
              type="url"
              value={form.resultsUrl}
              onChange={(e) => set("resultsUrl", e.target.value)}
              className="input"
              placeholder="https://…"
            />
          </Field>
        </div>

        <div className="flex items-center gap-6 pt-2 border-t">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => set("isPublished", e.target.checked)}
              className="h-4 w-4"
            />
            Publicar inmediatamente
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => set("isFeatured", e.target.checked)}
              className="h-4 w-4"
            />
            Destacada en home
          </label>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
          <Link href="/admin/races" className="text-sm text-gray-500 hover:underline">
            Cancelar
          </Link>
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
