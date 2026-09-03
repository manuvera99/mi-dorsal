"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { analyzeFromUrl } from "./actions";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Save,
  AlertCircle,
  Wand2,
  Link as LinkIcon,
  ExternalLink,
  Database,
  CheckCircle2,
  AlertTriangle,
  Globe,
} from "lucide-react";

type Extracted = {
  name: string;
  slug: string;
  type: "scraper" | "api" | "manual";
  description: string;
  baseUrl: string;
  format: "html" | "pdf" | "calendar" | "api" | "json" | "rss" | "unknown";
  raceListUrl?: string;
  sampleRaceUrls: string[];
  estimatedRaces?: number;
  recommendedStrategy: string;
  difficulties: string[];
  raceTypes: string[];
  geoFocus: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

export default function FromUrlPage() {
  const router = useRouter();
  const useMock = isMockMode();
  const create = useMock ? null : useMutation(api.dataSources.create);
  const [url, setUrl] = useState("");
  const [analyzing, startAnalyze] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  if (useMock) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/admin/sources" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
        <h1 className="text-3xl font-bold mb-2">Añadir fuente desde URL</h1>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Modo mock — esta función requiere OPENAI_API_KEY configurado.
        </div>
      </div>
    );
  }

  const handleAnalyze = () => {
    setError(null);
    setExtracted(null);
    startAnalyze(async () => {
      const res = await analyzeFromUrl(url);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setExtracted(res.data);
      setSourceUrl(res.url);
    });
  };

  const set = (k: keyof Extracted, v: any) =>
    setExtracted((e) => (e ? { ...e, [k]: v } : e));

  const handleSave = async () => {
    if (!extracted || !create) return;
    setSaving(true);
    setError(null);
    try {
      // Config guardamos la metadata completa de scraping (estrategia, difficulties, format, etc.)
      // para referencia futura cuando alguien escriba el scraper específico.
      const config = {
        format: extracted.format,
        raceListUrl: extracted.raceListUrl,
        sampleRaceUrls: extracted.sampleRaceUrls,
        estimatedRaces: extracted.estimatedRaces,
        recommendedStrategy: extracted.recommendedStrategy,
        difficulties: extracted.difficulties,
        raceTypes: extracted.raceTypes,
        geoFocus: extracted.geoFocus,
        confidence: extracted.confidence,
        aiNotes: extracted.notes,
        aiAnalyzedAt: new Date().toISOString(),
        aiSourceUrl: sourceUrl,
      };

      await create({
        name: extracted.name,
        slug: extracted.slug,
        type: extracted.type,
        description: extracted.description || undefined,
        baseUrl: extracted.baseUrl || sourceUrl || undefined,
        config,
      });
      router.push("/admin/sources");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/admin/sources"
        className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Volver a fuentes
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Database className="h-7 w-7 text-runner-primary" />
        <h1 className="text-3xl font-bold">Añadir fuente desde URL</h1>
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Pega una URL (calendario de federación, plataforma de carreras, etc.) y la IA la analiza como
        potencial fuente de datos: tipo, estrategia de scraping, dificultades, foco geográfico…
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
          <LinkIcon className="inline h-4 w-4 mr-1" /> URL de la web a analizar
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.federacion-carreras.es/calendario"
            className="input flex-1"
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !url}
            className="inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {analyzing ? "Analizando…" : "Analizar con IA"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          La web se descarga, se limpia y se envía a MiniMax M3 (~5-10s, gratis).
        </p>
      </div>

      {extracted && (
        <div className="bg-white border rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-green-600" /> Análisis de la fuente
            </h2>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-500 hover:text-runner-primary flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> {sourceUrl}
              </a>
            )}
          </div>

          <ConfidenceBanner confidence={extracted.confidence} />

          {extracted.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <div className="font-semibold mb-1 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Notas del análisis
              </div>
              {extracted.notes}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre *">
              <input
                type="text"
                required
                value={extracted.name}
                onChange={(e) => set("name", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Slug (URL-safe) *">
              <input
                type="text"
                required
                value={extracted.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="input font-mono"
              />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea
              value={extracted.description}
              onChange={(e) => set("description", e.target.value)}
              className="input min-h-[60px]"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Tipo">
              <select
                value={extracted.type}
                onChange={(e) => set("type", e.target.value as any)}
                className="input"
              >
                <option value="scraper">scraper (web HTML scrapeable)</option>
                <option value="api">api (API pública o JSON)</option>
                <option value="manual">manual (no scrapeable, requiere intervención)</option>
              </select>
            </Field>
            <Field label="Formato">
              <select
                value={extracted.format}
                onChange={(e) => set("format", e.target.value as any)}
                className="input"
              >
                <option value="html">html</option>
                <option value="pdf">pdf</option>
                <option value="calendar">calendar (ical)</option>
                <option value="api">api</option>
                <option value="json">json</option>
                <option value="rss">rss</option>
                <option value="unknown">unknown</option>
              </select>
            </Field>
            <Field label="Foco geográfico">
              <input
                type="text"
                value={extracted.geoFocus}
                onChange={(e) => set("geoFocus", e.target.value)}
                className="input"
                placeholder="España, Valencia, Madrid…"
              />
            </Field>
          </div>

          <Field label="URL base (canónica)">
            <input
              type="url"
              value={extracted.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="URL de listado de carreras (si la hay)">
            <input
              type="url"
              value={extracted.raceListUrl ?? ""}
              onChange={(e) => set("raceListUrl", e.target.value || undefined)}
              className="input"
              placeholder="https://…/calendario"
            />
          </Field>

          <Field label="Estrategia recomendada de scraping">
            <textarea
              value={extracted.recommendedStrategy}
              onChange={(e) => set("recommendedStrategy", e.target.value)}
              className="input min-h-[80px]"
            />
          </Field>

          {extracted.difficulties.length > 0 && (
            <Field label="Dificultades detectadas">
              <ul className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1 text-sm">
                {extracted.difficulties.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-red-800">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    {d}
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {extracted.sampleRaceUrls.length > 0 && (
            <Field label="URLs de ejemplo detectadas">
              <ul className="bg-gray-50 border rounded-md p-3 space-y-1 text-sm">
                {extracted.sampleRaceUrls.map((u, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-runner-primary hover:underline truncate"
                    >
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </Field>
          )}

          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || !extracted.name || !extracted.slug}
              className="inline-flex items-center gap-2 bg-runner-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar fuente
            </button>
            <button
              onClick={() => setExtracted(null)}
              className="text-sm text-gray-500 hover:underline"
            >
              Volver a analizar
            </button>
            <p className="ml-auto text-xs text-gray-500">
              Se creará como <strong>active</strong> lista para usar
            </p>
          </div>
        </div>
      )}

      {!extracted && !analyzing && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
          <Wand2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          Pega una URL y dale a <strong>"Analizar con IA"</strong>.
          <br />
          Funciona mejor con páginas de calendario/index de federaciones o plataformas de carreras.
        </div>
      )}
    </div>
  );
}

function ConfidenceBanner({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const map = {
    high: {
      color: "bg-green-50 border-green-200 text-green-800",
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Alta confianza",
      msg: "La IA está bastante segura de la metadata. Revisa y guarda.",
    },
    medium: {
      color: "bg-amber-50 border-amber-200 text-amber-800",
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Confianza media",
      msg: "La IA tiene dudas razonables. Revisa especialmente el formato y la estrategia.",
    },
    low: {
      color: "bg-red-50 border-red-200 text-red-800",
      icon: <AlertCircle className="h-4 w-4" />,
      label: "Baja confianza",
      msg: "La URL no parece una fuente agregadora. Probablemente es una página de carrera individual o un sitio no scrapeable.",
    },
  } as const;
  const c = map[confidence];
  return (
    <div className={`${c.color} border rounded-md p-3 text-sm flex items-start gap-2`}>
      {c.icon}
      <div>
        <strong>{c.label}.</strong> {c.msg}
      </div>
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
