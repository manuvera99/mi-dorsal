"use client";

/**
 * WelcomeOverlay — modal esquivable que se muestra la primera vez que un
 * usuario logueado aterriza en la app (post-sign-up o post-login).
 *
 * Reglas UX (ver docs/core/brand-voice.md, "tono cercano, humor sutil de corredor"):
 *  - Cero modal bloqueante con backdrop negro opaco: usamos blur sutil.
 *  - Mobile-first: el grid se apila en <md, las tarjetas van una debajo de otra.
 *  - Cierra con Escape, click fuera y X. Sin "Skip" agresivo: el link
 *    pequeño "Ya he estado por aquí" es un descarte honesto, no un skip.
 *  - Marca `onboardingWelcomeSeen=true` siempre que se cierre, indistintamente
 *    de la vía. La mutation `markWelcomeSeen` agenda el email welcome la
 *    primera vez (idempotente).
 *
 * Solo se muestra si:
 *  - Clerk está cargado y el usuario está logueado
 *  - Convex devuelve `welcomeSeen === false`
 *  - El usuario no lo ha descartado localmente en esta sesión
 *
 * El componente es client-side, no afecta al ISR de la home.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, MapPin, Trophy, Mail, ArrowRight, Sparkles } from "lucide-react";

export function WelcomeOverlay() {
  const { isSignedIn, isLoaded } = useUser();
  const state = useQuery(api.users.getOnboardingState);
  const markSeen = useMutation(api.users.markWelcomeSeen);
  const [dismissed, setDismissed] = useState(false);

  const shouldShow =
    isLoaded &&
    isSignedIn === true &&
    state !== undefined &&
    state !== null &&
    state.welcomeSeen === false &&
    dismissed === false;

  // Cerrar con Escape
  useEffect(() => {
    if (!shouldShow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  // Body scroll lock mientras se muestra
  useEffect(() => {
    if (!shouldShow) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shouldShow]);

  // Si la mutation ya no se va a poder llamar (logout), no intentarla
  const handleDismiss = () => {
    setDismissed(true);
    // Fire-and-forget: si falla, el usuario igual ya cerró el overlay.
    // La próxima vez que entre se le mostrará de nuevo si `welcomeSeen` quedó false.
    markSeen().catch((e) => {
      console.error("[welcome-overlay] markWelcomeSeen failed", e);
    });
  };

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={handleDismiss}
          aria-label="Cerrar bienvenida"
          className="absolute top-3 right-3 md:top-4 md:right-4 p-2 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Hero: dorsal mini + copy */}
        <div className="text-center mb-6">
          <div
            aria-hidden="true"
            className="inline-flex items-center justify-center mb-4 rounded-2xl bg-runner-primary text-white shadow-lg shadow-red-500/20 px-5 py-3"
          >
            <span className="font-mono text-3xl font-bold tracking-tighter">001</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest text-red-100 font-semibold">
              Dorsal
            </span>
          </div>
          <h1
            id="welcome-title"
            className="text-2xl md:text-3xl font-bold text-runner-dark mb-2 tracking-tight"
          >
            Tu dorsal empieza aquí.
          </h1>
          <p className="text-stone-600 text-sm md:text-base max-w-md mx-auto">
            Tres cosas y empiezas a correr en serio con nosotros. Sin manuales, sin tours eternos.
          </p>
        </div>

        {/* 3 tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Link
            href="/carreras"
            onClick={handleDismiss}
            className="group block p-4 rounded-xl bg-runner-primary text-white hover:bg-red-700 transition-colors shadow-sm"
          >
            <MapPin className="h-5 w-5 mb-2" aria-hidden="true" />
            <h2 className="font-semibold mb-1 text-sm md:text-base">
              Apúntate a tu próxima carrera
            </h2>
            <p className="text-xs text-red-100 leading-relaxed">
              Catálogo curado de carreras populares en España.
            </p>
          </Link>

          <Link
            href="/perfil"
            onClick={handleDismiss}
            className="group block p-4 rounded-xl border-2 border-stone-200 hover:border-runner-primary hover:bg-red-50/30 transition-colors"
          >
            <Trophy className="h-5 w-5 mb-2 text-runner-primary" aria-hidden="true" />
            <h2 className="font-semibold mb-1 text-stone-900 text-sm md:text-base">
              Añade tu primer PR
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Con una marca te predecimos el resto de distancias.
            </p>
          </Link>

          <Link
            href="/#how-it-works"
            onClick={handleDismiss}
            className="group block p-4 rounded-xl border-2 border-stone-200 hover:border-runner-primary hover:bg-red-50/30 transition-colors"
          >
            <Mail className="h-5 w-5 mb-2 text-runner-primary" aria-hidden="true" />
            <h2 className="font-semibold mb-1 text-stone-900 text-sm md:text-base">
              Mira cómo llega el resultado
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tu tiempo oficial + diploma PDF, en tu buzón.
            </p>
          </Link>
        </div>

        {/* CTA principal */}
        <Link
          href="/carreras"
          onClick={handleDismiss}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          <Sparkles className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Empezar por las carreras
          <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
        </Link>

        {/* Skip honesto */}
        <button
          onClick={handleDismiss}
          className="block w-full text-center mt-3 py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          Ya he estado por aquí
        </button>

        {/* Disclaimer (consistente con testimonios de la home) */}
        <p className="mt-4 text-[11px] text-stone-400 text-center leading-relaxed">
          Puedes cerrar esto cuando quieras. No se vuelve a mostrar.
        </p>
      </div>
    </div>
  );
}
