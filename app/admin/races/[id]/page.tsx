"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { PROVINCE_LIST } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Trash2, Wand2, Sparkles, CheckCircle2, AlertCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { deepExtractAction } from "./actions";
import type { ExtractedRaceDeep } from "@/lib/ai/extract-race-deep";

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

  // Deep extraction state
  const [deepUrl, setDeepUrl] = useState("");
  const [extracted, setExtracted] = useState<ExtractedRaceDeep | null>(null);
  const [extractedAt, setExtractedAt] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

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
      setDeepUrl(race.officialUrl ?? "");
    }
  }, [race]);

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

  const handleDeepExtract = () => {
    setError(null);
    setApplyMessage(null);
    setExtracted(null);
    startExtract(async () => {
      const res = await deepExtractAction(deepUrl);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setExtracted(res.data);
      setExtractedAt(res.url);
    });
  };

  const handleApplyExtraction = async () => {
    if (!extracted || !update) return;
    setApplying(true);
    setError(null);
    setApplyMessage(null);
    try {
      // Construir patch con todos los campos que la IA haya rellenado
      const patch: any = { extractedFromUrl: extractedAt, extractedAt: Date.now() };
      const copyField = (key: string) => {
        const v = (extracted as any)[key];
        if (v !== null && v !== undefined && v !== "") patch[key] = v;
      };
      // Strings simples
      [
        "name", "startTime", "address", "venue", "longDescription",
        "organizer", "organizerUrl", "contactEmail", "contactPhone",
        "dorsalPickupLocation", "dorsalPickupHours",
        "regulationUrl", "mapUrl", "mapEmbedUrl", "altimetryImageUrl",
        "gpxUrl", "mapImageUrl", "profileImageUrl",
        "registrationOpenDate", "registrationCloseDate",
        "socialInstagram", "socialFacebook", "socialTwitter", "socialYoutube",
        "prizes",
      ].forEach(copyField);
      // Numbers
      if (typeof extracted.maxParticipants === "number" && extracted.maxParticipants > 0) {
        patch.maxParticipants = extracted.maxParticipants;
      }
      if (typeof extracted.timeLimitMinutes === "number" && extracted.timeLimitMinutes > 0) {
        patch.timeLimitMinutes = extracted.timeLimitMinutes;
      }
      // Booleans
      if (typeof extracted.soldOut === "boolean") patch.soldOut = extracted.soldOut;
      if (typeof extracted.trophies === "boolean") patch.trophies = extracted.trophies;
      if (extracted.courseType) patch.courseType = extracted.courseType;
      // Arrays / objects
      if (extracted.raceFormats?.length) patch.raceFormats = extracted.raceFormats;
      if (extracted.aidStations?.length) patch.aidStations = extracted.aidStations;
      if (extracted.priceTiers?.length) patch.priceTiers = extracted.priceTiers;
      if (extracted.cutoffs?.length) patch.cutoffs = extracted.cutoffs;
      if (extracted.categories?.length) patch.categories = extracted.categories;
      if (extracted.galleryUrls?.length) patch.galleryUrls = extracted.galleryUrls;
      if (extracted.altimetryData?.length) patch.altimetryData = extracted.altimetryData;
      if (extracted.services && Object.keys(extracted.services).length > 0) {
        patch.services = extracted.services;
      }
      if (extracted.confidence) patch.extractionConfidence = extracted.confidence;

      const fieldsCount = Object.keys(patch).length;
      await update({ id: id as any, patch });
      setApplyMessage(`✅ ${fieldsCount} campos actualizados desde la extracción. Recarga para verlos en el formulario.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(false);
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

      {/* ============ DEEP EXTRACTION CON IA ============ */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-purple-900">Extracción profunda con IA</h2>
        </div>
        <p className="text-sm text-purple-800 mb-3">
          Pega una URL (la web oficial, /recorrido, /reglamento…) y MiniMax M3 extrae TODO lo que
          pueda: modalidades, avituallamientos detallados, tramos de precio, altimetría per-km, dorsal
          pickup, contacto, redes, servicios. Revisa y aplica los campos.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="url"
            value={deepUrl}
            onChange={(e) => setDeepUrl(e.target.value)}
            placeholder="https://www.organizador.com/carrera"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={handleDeepExtract}
            disabled={extracting || !deepUrl}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {extracting ? "Extrayendo…" : "Re-extraer con IA"}
          </button>
        </div>
        <p className="text-xs text-purple-700">~10-30s. La web se descarga y se procesa con M3 (gratis).</p>

        {extracted && (
          <div className="mt-4 bg-white border border-purple-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <strong className="text-sm">Extracción completada</strong>
                <ConfidenceBadge c={extracted.confidence} />
              </div>
              {extractedAt && (
                <a href={extractedAt} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {extractedAt}
                </a>
              )}
            </div>
            {extracted.notes && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2 mb-3">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                {extracted.notes}
              </div>
            )}
            <ExtractionSummary data={extracted} />
            <button
              type="button"
              onClick={handleApplyExtraction}
              disabled={applying}
              className="mt-4 inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {applying ? "Aplicando…" : "Aplicar todos los campos extraídos"}
            </button>
            {applyMessage && (
              <p className="mt-2 text-sm text-green-700">{applyMessage}</p>
            )}
          </div>
        )}
      </div>

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

function ConfidenceBadge({ c }: { c: "high" | "medium" | "low" }) {
  const map = {
    high: { color: "bg-green-100 text-green-700", label: "Alta" },
    medium: { color: "bg-amber-100 text-amber-700", label: "Media" },
    low: { color: "bg-red-100 text-red-700", label: "Baja" },
  } as const;
  const m = map[c];
  return <span className={`text-xs px-2 py-0.5 rounded ${m.color}`}>Confianza {m.label}</span>;
}

function ExtractionSummary({ data }: { data: ExtractedRaceDeep }) {
  const items: Array<[string, unknown]> = [
    ["Nombre", data.name],
    ["Hora de salida", data.startTime],
    ["Lugar", data.venue],
    ["Dirección", data.address],
    ["Modalidades", data.raceFormats],
    ["Avituallamientos", data.aidStations],
    ["Tramos de precio", data.priceTiers],
    ["Dorsal pickup", data.dorsalPickupLocation],
    ["Recogida de dorsal horario", data.dorsalPickupHours],
    ["Reglamento URL", data.regulationUrl],
    ["Mapa URL", data.mapUrl],
    ["Altimetría imagen", data.altimetryImageUrl],
    ["GPX", data.gpxUrl],
    ["Altimetría per-km", data.altimetryData],
    ["Contacto email", data.contactEmail],
    ["Contacto teléfono", data.contactPhone],
    ["Organizador", data.organizer],
    ["Instagram", data.socialInstagram],
    ["Facebook", data.socialFacebook],
    ["Twitter", data.socialTwitter],
    ["Inscripción cierre", data.registrationCloseDate],
    ["Máx participantes", data.maxParticipants],
    ["Servicios", data.services],
    ["Categorías", data.categories],
    ["Cutoffs", data.cutoffs],
    ["Premios", data.prizes],
    ["Galería", data.galleryUrls],
  ];

  const filled = items.filter(([_, v]) => {
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
    return true;
  });

  if (filled.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        La IA no encontró datos extraíbles en esta URL. Prueba con otra subpágina (ej: /recorrido, /reglamento).
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold mb-2">
        {filled.length} campo{filled.length === 1 ? "" : "s"} detectado{filled.length === 1 ? "" : "s"}:
      </p>
      <ul className="text-xs space-y-0.5 max-h-48 overflow-y-auto bg-gray-50 rounded p-2">
        {filled.map(([k, v]) => (
          <li key={k} className="flex items-start gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>{k}:</strong>{" "}
              {Array.isArray(v)
                ? `${v.length} elemento${v.length === 1 ? "" : "s"}`
                : typeof v === "object"
                ? `${Object.keys(v as object).length} propiedades`
                : typeof v === "string" && v.length > 60
                ? v.slice(0, 60) + "…"
                : String(v)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
