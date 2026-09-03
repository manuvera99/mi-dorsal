"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { PROVINCE_LIST } from "@/lib/utils";
import Link from "next/link";
import { extractFromUrl } from "./actions";
import { ArrowLeft, Sparkles, Loader2, Save, AlertCircle, Wand2, Link as LinkIcon, ExternalLink } from "lucide-react";

type Extracted = {
  name: string;
  startDate?: string;
  locality?: string;
  province?: string;
  distanceKm?: number;
  raceType?: "road" | "trail" | "mixed" | "obstacle";
  description?: string;
  organizer?: string;
  officialUrl?: string;
  registrationUrl?: string;
  imageUrl?: string;
  elevationGainM?: number;
};

export default function FromUrlPage() {
  const router = useRouter();
  const useMock = isMockMode();
  const create = useMock ? null : useMutation(api.races.create);
  const [url, setUrl] = useState("");
  const [extracting, startExtract] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  if (useMock) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/admin/races" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
        <h1 className="text-3xl font-bold mb-2">Crear desde URL</h1>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Modo mock — esta función requiere OPENAI_API_KEY configurado.
        </div>
      </div>
    );
  }

  const handleExtract = () => {
    setError(null);
    setExtracted(null);
    startExtract(async () => {
      const res = await extractFromUrl(url);
      if (res.error) {
        setError(res.error);
        return;
      }
      setExtracted(res.data);
      setSourceUrl(res.url);
    });
  };

  const set = (k: keyof Extracted, v: any) => setExtracted((e) => e ? { ...e, [k]: v } : e);

  const handleSave = async () => {
    if (!extracted || !create) return;
    setSaving(true);
    setError(null);
    try {
      const id = await create({
        name: extracted.name,
        startDate: extracted.startDate || undefined,
        locality: extracted.locality || undefined,
        province: (extracted.province || "valencia") as any,
        distanceKm: Number(extracted.distanceKm) || 10,
        elevationGainM: Number(extracted.elevationGainM) || undefined,
        raceType: (extracted.raceType || "road") as any,
        description: extracted.description || undefined,
        organizer: extracted.organizer || undefined,
        officialUrl: extracted.officialUrl || sourceUrl || undefined,
        registrationUrl: extracted.registrationUrl || undefined,
        isPublished: true,
        isFeatured: false,
      });
      router.push(`/admin/races/${id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/admin/races" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Volver a carreras
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-7 w-7 text-runner-primary" />
        <h1 className="text-3xl font-bold">Crear carrera desde URL</h1>
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Pega una URL (web del organizador, cronometrador, etc.) y la IA extrae los datos automáticamente.
        Revisa antes de guardar.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <LinkIcon className="inline h-4 w-4 mr-1" /> URL de la carrera
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.organizador.com/carrera-2026"
            className="input flex-1"
          />
          <button
            onClick={handleExtract}
            disabled={extracting || !url}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {extracting ? "Extrayendo…" : "Extraer con IA"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          La web se descarga y se envía a GPT-4o-mini (~1-2s, ~$0.01 por extracción).
          Solo se procesa la URL, no se guarda nada.
        </p>
      </div>

      {extracted && (
        <div className="bg-white border rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-green-600" /> Datos extraídos
            </h2>
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-runner-primary flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> {sourceUrl}
              </a>
            )}
          </div>

          <Field label="Nombre *">
            <input type="text" required value={extracted.name} onChange={(e) => set("name", e.target.value)} className="input" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Localidad">
              <input type="text" value={extracted.locality ?? ""} onChange={(e) => set("locality", e.target.value)} className="input" />
            </Field>
            <Field label="Provincia">
              <select value={extracted.province ?? ""} onChange={(e) => set("province", e.target.value)} className="input">
                <option value="">—</option>
                {PROVINCE_LIST.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Distancia (km)">
              <input type="number" step="0.1" min="0" value={extracted.distanceKm ?? ""} onChange={(e) => set("distanceKm", e.target.value ? Number(e.target.value) : undefined)} className="input" />
            </Field>
            <Field label="Desnivel (m)">
              <input type="number" min="0" value={extracted.elevationGainM ?? ""} onChange={(e) => set("elevationGainM", e.target.value ? Number(e.target.value) : undefined)} className="input" />
            </Field>
            <Field label="Tipo">
              <select value={extracted.raceType ?? "road"} onChange={(e) => set("raceType", e.target.value as any)} className="input">
                <option value="road">Asfalto</option>
                <option value="trail">Trail</option>
                <option value="mixed">Mixta</option>
                <option value="obstacle">Obstáculos</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Fecha (YYYY-MM-DD)">
              <input type="date" value={extracted.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} className="input" />
            </Field>
            <Field label="Organizador">
              <input type="text" value={extracted.organizer ?? ""} onChange={(e) => set("organizer", e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea value={extracted.description ?? ""} onChange={(e) => set("description", e.target.value)} className="input min-h-[80px]" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Web oficial">
              <input type="url" value={extracted.officialUrl ?? ""} onChange={(e) => set("officialUrl", e.target.value)} className="input" />
            </Field>
            <Field label="URL inscripción">
              <input type="url" value={extracted.registrationUrl ?? ""} onChange={(e) => set("registrationUrl", e.target.value)} className="input" />
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || !extracted.name}
              className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar y crear
            </button>
            <button onClick={() => setExtracted(null)} className="text-sm text-gray-500 hover:underline">
              Volver a extraer
            </button>
          </div>
        </div>
      )}

      {!extracted && !extracting && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
          <Wand2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          Pega una URL y dale a <strong>"Extraer con IA"</strong>.<br/>
          Funciona mejor con páginas que tengan info clara: nombre, fecha, distancia, lugar.
        </div>
      )}
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
