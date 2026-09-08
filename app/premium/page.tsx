// =============================================================================
// mi-dorsal — /premium (landing pública de venta)
// =============================================================================
// Página de marketing para usuarios anónimos que llegan desde SEO,
// redes o email. Su único objetivo: que se suscriban.
//
// Estructura:
//   1) Hero: promesa + PricingTable directo
//   2) Comparativa Free vs Premium (tabla con checks/cruces)
//   3) Beneficios detallados (iconos + descripciones)
//   4) FAQ (5-6 preguntas frecuentes)
//   5) CTA final + footer con links a legales
//
// Es un Server Component porque la página no necesita estado de cliente
// salvo el PricingTable (que Clerk ya gestiona como island). Esto da
// mejor SEO y TBT.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, Sparkles, Trophy, Brain, MapPin, Bell, Download, BarChart3, Headphones, Mail } from "lucide-react";
import { PricingTableSection } from "@/components/billing/pricing-table";
import { JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/components/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export const metadata: Metadata = {
  title: "mi-dorsal Premium — Más de tu temporada de carreras",
  description:
    "Sincronización Strava en tiempo real, entrenador IA ilimitado, planificación de temporada y alertas personalizadas. Desde 4,99 €/mes. Sin compromiso, cancela cuando quieras.",
  alternates: {
    canonical: "/premium",
  },
  openGraph: {
    title: "mi-dorsal Premium",
    description: "Más de tu temporada de carreras. Predice, sincroniza, planifica.",
    url: `${BASE_URL}/premium`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mi-dorsal Premium",
    description: "Más de tu temporada de carreras. Predice, sincroniza, planifica.",
  },
};

// ---------------------------------------------------------------------------
// Datos de la página (estáticos, server-rendered)
// ---------------------------------------------------------------------------

type PlanFeature = {
  /** Categoría para agrupar en la tabla comparativa. */
  category: string;
  /** Nombre legible. */
  label: string;
  free: string | boolean;
  premium: string | boolean;
};

const PLAN_FEATURES: PlanFeature[] = [
  // Catálogo y comunidad (siempre free)
  { category: "Catálogo y comunidad", label: "Ver catálogo de carreras", free: true, premium: true },
  { category: "Catálogo y comunidad", label: "Votar y comentar carreras", free: true, premium: true },
  { category: "Catálogo y comunidad", label: "Recibir resultados por email", free: true, premium: true },
  { category: "Catálogo y comunidad", label: "Newsletter editorial", free: true, premium: true },

  // Calendario (free, sin límite — Pro es "comodidad", no acceso)
  { category: "Calendario personal", label: "Carreras en tu calendario", free: "Sin límite", premium: "Sin límite" },
  { category: "Calendario personal", label: "Marcar dorsales y notas", free: true, premium: true },
  { category: "Calendario personal", label: "Exportar a Google/Apple Calendar", free: false, premium: true },
  { category: "Calendario personal", label: "Widget público para tu web/blog", free: false, premium: true },

  // PRs (siempre free — son la base del producto)
  { category: "Marcas personales", label: "Añadir PRs a mano", free: "Ilimitados", premium: "Ilimitados" },
  { category: "Marcas personales", label: "Subir export de Strava (ZIP)", free: true, premium: true },
  { category: "Marcas personales", label: "Re-subir export tras cambiar de dispositivo", free: false, premium: true },

  // Predicciones (siempre free, coste $0)
  { category: "Predicciones y análisis", label: "Predicción de tiempo (Daniels VDOT)", free: "Ilimitadas", premium: "Ilimitadas + alta confianza" },
  { category: "Predicciones y análisis", label: "Entrenador IA con voz de club", free: "1 al mes", premium: "Ilimitado" },
  { category: "Predicciones y análisis", label: "Planificación inteligente de temporada", free: false, premium: true },
  { category: "Predicciones y análisis", label: "Estadísticas avanzadas de tus PRs", free: false, premium: true },
  { category: "Predicciones y análisis", label: "Compararte con la comunidad", free: false, premium: true },

  // Integraciones (Strava OAuth solo Pro — consume API; export ZIP libre)
  { category: "Integraciones", label: "Subir export de Strava (ZIP, una vez)", free: true, premium: true },
  { category: "Integraciones", label: "Sincronización Strava OAuth (API + webhook tiempo real)", free: false, premium: true },
  { category: "Integraciones", label: "Sincronización con Garmin", free: false, premium: "Próximamente" },

  // Alertas y soporte
  { category: "Alertas y soporte", label: "Alertas personalizadas (carreras en tu zona, nuevas ediciones)", free: false, premium: true },
  { category: "Alertas y soporte", label: "Soporte prioritario (24 h)", free: false, premium: true },
];

type Benefit = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const BENEFITS: Benefit[] = [
  {
    icon: Brain,
    title: "Predice tu tiempo en cualquier carrera",
    description:
      "Con tu mejor marca en una distancia te decimos cuánto harás en otra. Modelo Daniels VDOT calibrado con datos reales de corredores populares.",
  },
  {
    icon: Trophy,
    title: "Sincroniza Strava y Garmin",
    description:
      "Tus actividades se importan solas. Detectamos carreras, actualizamos tus PRs y te avisamos si has batido una marca.",
  },
  {
    icon: MapPin,
    title: "Planifica tu temporada",
    description:
      "Te sugerimos qué carreras encajan con tus marcas y tu calendario. Sin conflictos, sin inscripciones de última hora.",
  },
  {
    icon: Bell,
    title: "Alertas que sí importan",
    description:
      "Abre inscripciones de tu carrera favorita, cambio de horario, nuevo avituallamiento. Solo lo que te interesa, a tu ritmo.",
  },
  {
    icon: Download,
    title: "Exporta a donde quieras",
    description:
      "Calendario a Google Calendar o Apple Calendar. Tus marcas a CSV. Sin lock-in, tus datos son tuyos.",
  },
  {
    icon: BarChart3,
    title: "Estadísticas que motivan",
    description:
      "Evolución de tus PRs, comparativa con la comunidad, tendencias por distancia. Datos como celebración, no como reporte.",
  },
];

type FaqItem = { question: string; answer: string };

const FAQ: FaqItem[] = [
  {
    question: "¿Cuánto cuesta mi-dorsal Premium?",
    answer:
      "Desde 4,99 €/mes o 39 €/año (35% de descuento). Puedes probar 14 días gratis sin tarjeta. Cancela en cualquier momento desde tu cuenta.",
  },
  {
    question: "¿Qué pasa si cancelo?",
    answer:
      "Mantienes acceso premium hasta que termine el periodo que ya pagaste. Después, vuelves automáticamente al plan Free y conservas todos tus datos.",
  },
  {
    question: "¿Mis datos están a salvo?",
    answer:
      "Tus datos son tuyos. Puedes exportar todo (carreras guardadas, PRs, actividades) en CSV o JSON cuando quieras. Cumplimos RGPD.",
  },
  {
    question: "¿Necesito Strava o Garmin?",
    answer:
      "No. Premium funciona sin ellos. Si los conectas, se sincronizan las actividades y se actualizan tus PRs automáticamente. Pero no son obligatorios.",
  },
  {
    question: "¿Hay plan familiar?",
    answer:
      "Estamos trabajando en él. Por ahora cada usuario tiene su propia cuenta y suscripción. Si sois 3+ corredores de la misma familia, escríbenos a hola@mi-dorsal.es y te hacemos precio.",
  },
  {
    question: "¿Puedo pedir reembolso?",
    answer:
      "Sí, dentro de los 14 días desde el cobro si no has usado features premium. Escríbenos a hola@mi-dorsal.es y lo gestionamos en 24 h.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PremiumPage() {
  return (
    <>
      {/* JSON-LD: FAQPage + BreadcrumbList para SEO */}
      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: BASE_URL },
          { name: "Premium", url: `${BASE_URL}/premium` },
        ])}
      />

      <div className="bg-runner-warm">
        {/* 1) HERO */}
        <section className="px-4 py-16 sm:py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Premium
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900 mb-4">
              Más de tu temporada de carreras.
            </h1>
            <p className="text-lg text-stone-700 mb-8 max-w-2xl mx-auto">
              Predice tus tiempos, sincroniza Strava, planifica tu temporada y recibe
              alertas personalizadas. Desde 4,99 €/mes.
            </p>
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 max-w-3xl mx-auto">
              <PricingTableSection hideFree />
            </div>
            <p className="text-xs text-stone-500 mt-3">
              14 días gratis sin tarjeta. Cancela cuando quieras.
            </p>
          </div>
        </section>

        {/* 2) COMPARATIVA */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-2">
              Free vs Premium
            </h2>
            <p className="text-center text-stone-600 mb-10">
              Lo que te llevas con cada plan, sin sorpresas.
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="text-left p-4 font-semibold text-stone-700">Feature</th>
                    <th className="p-4 font-semibold text-stone-700 w-32 text-center">Free</th>
                    <th className="p-4 font-semibold text-amber-700 w-32 text-center">
                      <Sparkles className="inline h-4 w-4 mr-1" />
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((f, i) => {
                    const isFirstOfCategory = i === 0 || PLAN_FEATURES[i - 1].category !== f.category;
                    return (
                      <tr
                        key={f.label}
                        className={isFirstOfCategory ? "border-t-2 border-stone-200" : "border-t border-stone-100"}
                      >
                        <td className="p-4 text-sm text-stone-700">
                          {isFirstOfCategory && (
                            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
                              {f.category}
                            </div>
                          )}
                          {f.label}
                        </td>
                        <td className="p-4 text-sm text-center">
                          <FeatureValue value={f.free} />
                        </td>
                        <td className="p-4 text-sm text-center bg-amber-50/40">
                          <FeatureValue value={f.premium} highlight />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3) BENEFICIOS DETALLADOS */}
        <section className="px-4 py-12 sm:py-16 bg-white border-y border-stone-200">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-2">
              Qué desbloqueas
            </h2>
            <p className="text-center text-stone-600 mb-10">
              Features pensadas para el corredor popular, no para élites.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="rounded-xl border border-stone-200 p-6 hover:border-amber-300 transition-colors"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 text-amber-700 mb-3">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg text-stone-900 mb-1">
                    {b.title}
                  </h3>
                  <p className="text-sm text-stone-600">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4) FAQ */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-10">
              Preguntas frecuentes
            </h2>
            <div className="space-y-4">
              {FAQ.map((f) => (
                <details
                  key={f.question}
                  className="group bg-white rounded-xl border border-stone-200 p-5 open:border-amber-300 open:shadow-sm"
                >
                  <summary className="cursor-pointer font-semibold text-stone-900 list-none flex items-center justify-between">
                    {f.question}
                    <span className="text-stone-400 group-open:rotate-45 transition-transform text-2xl leading-none">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-stone-600 leading-relaxed">
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
            <p className="text-center text-sm text-stone-500 mt-6">
              ¿Más preguntas? Escríbenos a{" "}
              <a href="mailto:hola@mi-dorsal.es" className="text-runner-primary hover:underline">
                hola@mi-dorsal.es
              </a>
              .
            </p>
          </div>
        </section>

        {/* 5) CTA FINAL */}
        <section className="px-4 py-16 sm:py-20 bg-gradient-to-br from-runner-primary to-rose-700 text-white text-center">
          <div className="mx-auto max-w-2xl">
            <Sparkles className="inline h-8 w-8 mb-3" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Empieza tu prueba de 14 días
            </h2>
            <p className="text-rose-100 mb-6">
              Sin tarjeta, sin compromiso. Si no te convence, vuelves al Free
              con todos tus datos intactos.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md bg-white text-runner-primary px-6 py-3 font-semibold hover:bg-rose-50 transition-colors"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FeatureValue({ value, highlight = false }: { value: string | boolean; highlight?: boolean }) {
  if (value === true) {
    return <Check className={`inline h-5 w-5 ${highlight ? "text-amber-600" : "text-emerald-600"}`} />;
  }
  if (value === false) {
    return <X className="inline h-4 w-4 text-stone-300" />;
  }
  // String: ej "3 últimos", "Ilimitado"
  return <span className={highlight ? "font-semibold text-amber-800" : "text-stone-700"}>{value}</span>;
}
