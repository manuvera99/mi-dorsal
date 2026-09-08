"use client";

// =============================================================================
// mi-dorsal — Tarjeta de análisis del entrenador IA en /perfil
// =============================================================================
// Botón que dispara convex/actions/coachAnalysis.ts (LLM con voz de
// entrenador experimentado), muestra el resultado cacheado en el profile
// (coachAnalysisText/coachAnalysisAt), y permite regenerarlo.
//
// Mientras la action corre, mostramos un toast persistente y minimizable
// (abajo a la derecha) con un link de vuelta a /perfil. El usuario puede
// seguir navegando a otras páginas y volver cuando quiera — el resultado
// ya está cacheado en el profile.
// =============================================================================

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface CoachAnalysisCardProps {
  coachAnalysisText?: string;
  coachAnalysisAt?: number;
}

export function CoachAnalysisCard({ coachAnalysisText, coachAnalysisAt }: CoachAnalysisCardProps) {
  const generateAnalysis = useAction((api as any)["actions/coachAnalysis"].generateMyAnalysis);
  const toast = useToast();
  const [text, setText] = useState(coachAnalysisText);
  const [generatedAt, setGeneratedAt] = useState(coachAnalysisAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    // Toast persistente (no auto-cierra) que se queda visible mientras
    // el usuario navega. Lo actualizaremos al terminar.
    const toastId = toast.show({
      title: "Analizando tu registro de entrenamiento…",
      description:
        "Calculamos tu tipo de corredor, miramos tus marcas y redactamos el análisis. Tarda 10-30 segundos. Puedes seguir navegando.",
      variant: "info",
      durationMs: 0,
      action: { label: "Ver al acabar", href: "/perfil" },
    });

    try {
      const result = await generateAnalysis({});
      setText(result.text);
      setGeneratedAt(result.generatedAt);

      // Actualizar el toast a "completado"
      toast.dismiss(toastId);
      toast.show({
        title: "Tu análisis está listo",
        description: "Hemos actualizado la lectura de tu entrenador.",
        variant: "success",
        action: { label: "Ver análisis", href: "/perfil" },
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudo generar el análisis. Inténtalo de nuevo en un momento.");
      toast.dismiss(toastId);
      toast.show({
        title: "No pudimos generar el análisis",
        description: e?.message ?? "Inténtalo de nuevo en un momento.",
        variant: "warning",
        durationMs: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-runner-primary" />
          Análisis de tu entrenador
        </h2>
        {text && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs text-runner-primary hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Regenerar
          </button>
        )}
      </div>

      {!text ? (
        <div className="py-6 px-2 text-center">
          <p className="text-sm text-stone-600 max-w-sm mx-auto mb-4 leading-relaxed">
            Un entrenador con criterio propio, no un generador de frases motivacionales:
            analiza tu registro de entrenamiento (volumen, consistencia, tipos de sesión,
            marcas) y te dice qué estás haciendo bien y qué cambiaría.
          </p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Generando…
              </span>
            ) : (
              "Pedir análisis"
            )}
          </button>
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mt-3">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="prose-sm max-w-none [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-semibold">
            <MarkdownRenderer content={text} />
          </div>
          {generatedAt && (
            <p className="text-xs text-gray-400 mt-3">
              Generado el{" "}
              {new Date(generatedAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              . Los datos cambian con cada nueva actividad — regenera cuando quieras una lectura
              actualizada.
            </p>
          )}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mt-3">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
