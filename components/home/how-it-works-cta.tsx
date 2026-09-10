"use client";

/**
 * HowItWorksCta — botón "Empieza tu temporada gratis" al final de
 * <HowItWorks>. Extraído a su propio componente para poder comprobar
 * sesión sin convertir todo <HowItWorks> (contenido SEO, se renderiza
 * en el HTML estático de la home) en client-only.
 *
 * Es un CTA de registro, no de upgrade a Pro — no tiene sentido para
 * ningún usuario ya logueado (bug reportado sesión 10 sep 2026, mismo
 * motivo que final-cta.tsx).
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { isMockMode } from "@/lib/mock/provider";

function CtaLink() {
  return (
    <Link
      href="/sign-up"
      className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-md hover:bg-red-50 transition-colors"
    >
      Empieza tu temporada gratis
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function HowItWorksCta() {
  if (isMockMode()) return <CtaLink />;
  return <RealHowItWorksCta />;
}

function RealHowItWorksCta() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || isSignedIn) return null;
  return <CtaLink />;
}
