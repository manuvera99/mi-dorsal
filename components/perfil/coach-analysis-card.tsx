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
//
// Rate limit (sesión 8 sep 2026):
//   - admin / test / pro: ilimitado (no se muestra contador)
//   - free: 1 al mes
// Cuando el free ha agotado su cuota del mes, el botón se deshabilita
// y se muestra un mensaje claro + un CTA suave a /cuenta/suscripcion
// (no es un paywall bloqueante — Manu decidió que el free puede hacer
// 1/mes, no que tenga que pagar para nada).
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MarkdownRenderer } from "@/components/blog/MarkdownRenderer";
import { Sparkles, Loader2, RefreshCw, Lock } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface CoachAnalysisCardProps {
  coachAnalysisText?: string;
  coachAnalysisAt?: number;
}

type CoachUsage = {
  count: number;
  limit: number; // -1 = ilimitado
  resetAt: number | null;
  role: string | null;
};

export function CoachAnalysisCard({ coachAnalysisText, coachAnalysisAt }: CoachAnalysisCardProps) {
  const generateAnalysis = useAction((api as any)["actions/coachAnalysis"].generateMyAnalysis);
  const toast = useToast();
  const [text, setText] = useState(coachAnalysisText);
  const [generatedAt, setGeneratedAt] = useState(coachAnalysisAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suscripción al estado del rate limit del coach. Re-renderiza
  // automáticamente cuando el counter cambia (post-generación o reset
  // mensual vía cron).
  const usage = useQuery(api.coachAnalysisHelpers.getMyCoachUsage, {}) as CoachUsage | undefined;

  // Derivados: ¿está agotado el límite? (solo si hay límite finito y
  // count >= limit)
  const isUnlimited = usage?.limit === -1;
  const isAtLimit = !isUnlimited && usage != null && usage.count >= usage.limit;
  const remaining = usage ? Math.max(0, usage.limit - usage.count) : 0;

  const handleGenerate = async () => {
    if (isAtLimit) return; // safety: el botón está disabled, pero por si acaso
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
      const msg = e?.message ?? "No se pudo generar el análisis. Inténtalo de nuevo en un momento.";
      setError(msg);
      toast.dismiss(toastId);
      toast.show({
        title: "No pudimos generar el análisis",
        description: msg,
        variant: "warning",
        durationMs: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Texto del contador: "X de Y al mes" si hay límite finito,
  // null si es ilimitado (no hace falta contador).
  const counterText = isUnlimited
    ? null
    : usage
      ? `${usage.count} de ${usage.limit} al mes`
      : "…";

  // Fecha de reset formateada para el mensaje cuando se agota.
  const resetDateText = usage?.resetAt
    ? new Date(usage.resetAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-runner-primary" />
          Análisis de tu entrenador
        </h2>
        <div className="flex items-center gap-3">
          {counterText && (
            <span
              className={`text-xs ${isAtLimit ? "text-amber-700 font-semibold" : "text-stone-500"}`}
              title={resetDateText ? `Se resetea el ${resetDateText}` : undefined}
            >
              {counterText}
            </span>
          )}
          {text && !isAtLimit && (
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
      </div>

      {!text ? (
        <div className="py-6 px-2 text-center">
          <p className="text-sm text-stone-600 max-w-sm mx-auto mb-4 leading-relaxed">
            Un entrenador con criterio propio, no un generador de frases motivacionales:
            analiza tu registro de entrenamiento (volumen, consistencia, tipos de sesión,
            marcas) y te dice qué estás haciendo bien y qué cambiaría.
          </p>
          {isAtLimit ? (
            <LimitReachedMessage resetDateText={resetDateText} remaining={remaining} />
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generando…
                </span>
              ) : (
                "Pedir análisis"
              )}
            </button>
          )}
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
          {isAtLimit && !loading && (
            <LimitReachedMessage resetDateText={resetDateText} remaining={remaining} compact />
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

/** Mensaje que se muestra cuando el free ha agotado su cuota del mes.
 *  NO es un paywall bloqueante: Manu decidió que el free puede hacer
 *  1 al mes. Mostramos CTA suave a /cuenta/suscripcion por si quiere
 *  más, pero el usuario no se queda sin poder ver el resultado
 *  generado este mes — sí puede. */
function LimitReachedMessage({
  resetDateText,
  remaining,
  compact = false,
}: {
  resetDateText: string | null;
  remaining: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 mt-3 flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Has usado tus {remaining === 0 ? "análisis" : "intentos"} este mes.
          {resetDateText && <> Se resetea el {resetDateText}.</>}{" "}
          <Link
            href="/cuenta/suscripcion"
            className="text-runner-primary hover:underline font-medium"
          >
            Hazte Premium
          </Link>{" "}
          para análisis ilimitados.
        </span>
      </p>
    );
  }
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 max-w-sm mx-auto">
      <div className="flex items-start gap-2">
        <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium mb-1">Has agotado tu análisis de este mes.</p>
          <p className="text-xs text-amber-800 mb-2">
            {resetDateText
              ? `Se resetea el ${resetDateText}. `
              : "El contador se resetea el día 1 del mes que viene. "}
            Con Premium tienes análisis ilimitados y más funciones.
          </p>
          <Link
            href="/cuenta/suscripcion"
            className="text-xs font-semibold text-runner-primary hover:underline"
          >
            Ver planes Premium →
          </Link>
        </div>
      </div>
    </div>
  );
}
