// =============================================================================
// mi-dorsal — /feedback
// =============================================================================
// Página pública donde cualquier usuario puede:
//   - Reportar un bug 🐛
//   - Sugerir una idea / mejora 💡
//   - Dejar feedback general 💬
//
// Acceso desde el footer. Funciona para usuarios logueados y anónimos.
// =============================================================================

import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "./client";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";

export const metadata: Metadata = {
  title: "Feedback · Reporta un bug o sugiere una mejora · mi-dorsal",
  description:
    "Echas algo en falta en mi-dorsal? ¿Te has topado con un bug? Dínoslo y lo arreglamos. Tu feedback hace que la app sea mejor para todos los corredores.",
  alternates: {
    canonical: "/feedback",
  },
  robots: {
    index: false, // No tiene sentido indexar la página de feedback
    follow: true,
  },
};

export default function FeedbackPage() {
  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-runner-dark mb-2">
            ¿Algo no va? ¿Algo que echamos en falta?
          </h1>
          <p className="text-gray-600">
            Tu feedback hace que mi-dorsal sea mejor para todos los corredores.
            Lo leemos todo, en serio.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-center py-12 text-gray-500">Cargando…</div>
          }
        >
          <FeedbackForm />
        </Suspense>
      </div>
    </>
  );
}
