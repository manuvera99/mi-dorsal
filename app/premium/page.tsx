// =============================================================================
// mi-dorsal — /premium (landing de marketing de Pro)
// =============================================================================
// Página pública de venta. Estructura:
//   1) HERO con propuesta de valor + 3 cards de pricing (Free / Pro
//      Mensual / Pro Anual). El CTA de cada card apunta a /sign-up
//      (free) o a /cuenta/suscripcion (pro, logueado) — la lógica
//      real de checkout vive en /api/stripe/checkout (no aquí, para
//      no chocar dos checkouts).
//   2) COMPARATIVA detallada (tabla Free vs Pro).
//   3) BENEFICIOS (6 features explicadas, no solo en lista).
//   4) SOCIAL PROOF con disclaimer de placeholder (mismo patrón que
//      /components/home/testimonials.tsx).
//   5) FAQ (6-8 preguntas de compra, reembolso, datos, etc.).
//   6) CTA final.
//
// Pricing expuesto (sesión 9 sep 2026, migración a Stripe directo):
//   - Free: gratis. Todo lo básico.
//   - Pro Mensual: 2,99 €/mes. Sin compromiso. SIN trial (cobro upfront).
//   - Pro Anual: 24,99 €/año. Equivale a 2,08 €/mes — ahorra 30%.
//     14 días de trial gratis (sin tarjeta).
//   Badge "Ahorra 30%" + "Más popular" en el anual.
//
// IMPORTANTE — MONEDA: cobramos en EUR directamente con Stripe directo
// (a diferencia de Clerk Billing que solo soporta USD, Stripe directo
// sí permite EUR nativo). El precio del producto en dashboard.stripe.com
// está en EUR.
//
// El pricing real de Stripe debe coincidir con estos importes cuando
// se activen siguiendo docs/BILLING_SETUP.md. Si se cambia el precio
// en Stripe (dashboard), hay que actualizarlo aquí también.
// NO TOCAR el billing de Stripe desde aquí — solo es la landing.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  X,
  Sparkles,
  Trophy,
  Brain,
  MapPin,
  Bell,
  Download,
  BarChart3,
  Mail,
  Shield,
  RotateCcw,
  Clock,
  Users,
  Star,
  Lock,
} from "lucide-react";
import { JsonLd, faqJsonLd, breadcrumbJsonLd } from "@/components/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.com";

export const metadata: Metadata = {
  title: "mi-dorsal Premium — Más de tu temporada de carreras",
  description:
    "Sincronización Strava en tiempo real y análisis ilimitado de tu perfil de corredor. Desde 2,99 €/mes. Sin compromiso, cancela cuando quieras.",
  alternates: { canonical: "/premium" },
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
// Datos de la página
// ---------------------------------------------------------------------------

/** Tier visualizado en cada card de pricing. */
type Tier = {
  id: "free" | "pro-monthly" | "pro-annual";
  name: string;
  /** Precio numérico para mostrar en grande. 0 = gratis. */
  price: number;
  /** Texto del periodo (ej "/mes", "/año"). Vacío si es gratis. */
  period: string;
  /** Texto destacado encima del precio (ej "Ahorra 50%", "Más popular"). */
  badge?: string;
  /** Color del badge. */
  badgeColor?: "amber" | "emerald";
  /** Subtítulo debajo del nombre del tier. */
  tagline: string;
  /** 3-5 bullets de lo que incluye el tier. */
  features: string[];
  /** CTA: label + href. */
  cta: { label: string; href: string };
  /** True si es el plan destacado. Le da borde y sombra extra. */
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "",
    tagline: "Para empezar tu hilo de dorsal sin pagar.",
    features: [
      "Catálogo completo de carreras de toda España",
      "Búsqueda, filtros y voto 8D de la comunidad",
      "Predicción de tiempo (Daniels VDOT) ilimitada",
      "PRs manuales ilimitados",
      "Subir export de Strava (ZIP) una vez",
      "Calendario personal sin límite",
      "Resultados por email con diploma",
    ],
    cta: { label: "Crear cuenta gratis", href: "/sign-up" },
  },
  {
    id: "pro-monthly",
    name: "Pro Mensual",
    price: 2.99,
    period: "/mes",
    tagline: "Pruébalo sin compromiso. Cancela cuando quieras.",
    features: [
      "Todo lo de Free, y además:",
      "Sincronización Strava OAuth (sync en tiempo real)",
      "Re-subir export de Strava ilimitado",
      "Análisis de tu perfil de corredor (sin límite)",
      "Soporte prioritario 24 h",
      "Alertas, export calendario y widget (próximamente)",
    ],
    cta: { label: "Probar 14 días gratis", href: "/cuenta/suscripcion" },
  },
  {
    id: "pro-annual",
    name: "Pro Anual",
    price: 24.99,
    period: "/año",
    badge: "Ahorra 30% · Más popular",
    badgeColor: "amber",
    tagline: "Para el corredor que planifica toda la temporada.",
    features: [
      "Todo lo de Pro Mensual, y además:",
      "Equivale a 2,08 €/mes (pagas una vez al año)",
      "Prioridad en features nuevas",
      "Badge de “fundador” en tu perfil",
    ],
    cta: { label: "Hacerme Pro anual", href: "/cuenta/suscripcion" },
    highlighted: true,
  },
];

/** Tabla comparativa Free vs Pro. Misma fuente que TIERS pero en formato
 *  plano para que se pueda iterar separado. La columna "Pro" representa
 *  los dos tiers de pago por igual (mensual y anual tienen las mismas
 *  features, solo cambia el precio). */
type PlanFeature = {
  category: string;
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
  { category: "Calendario personal", label: "Exportar a Google/Apple Calendar", free: false, premium: "Próximamente" },
  { category: "Calendario personal", label: "Widget público para tu web/blog", free: false, premium: "Próximamente" },

  // PRs (siempre free — son la base del producto)
  { category: "Marcas personales", label: "Añadir PRs a mano", free: "Ilimitados", premium: "Ilimitados" },
  { category: "Marcas personales", label: "Subir export de Strava (ZIP)", free: true, premium: true },
  { category: "Marcas personales", label: "Re-subir export tras cambiar de dispositivo", free: false, premium: true },

  // Predicciones (siempre free, coste $0)
  { category: "Predicciones y análisis", label: "Predicción de tiempo (Daniels VDOT)", free: "Ilimitadas", premium: "Ilimitadas + alta confianza" },
  { category: "Predicciones y análisis", label: "Análisis de tu perfil de corredor", free: "1 al mes", premium: "Ilimitado" },
  { category: "Predicciones y análisis", label: "Planificación inteligente de temporada", free: false, premium: "Próximamente" },
  { category: "Predicciones y análisis", label: "Estadísticas avanzadas de tus PRs", free: false, premium: "Próximamente" },
  { category: "Predicciones y análisis", label: "Compararte con la comunidad", free: false, premium: "Próximamente" },

  // Integraciones (Strava OAuth solo Pro — consume API; export ZIP libre)
  { category: "Integraciones", label: "Subir export de Strava (ZIP, una vez)", free: true, premium: true },
  { category: "Integraciones", label: "Sincronización Strava OAuth (API + webhook tiempo real)", free: false, premium: true },
  { category: "Integraciones", label: "Sincronización con Garmin", free: false, premium: "Próximamente" },

  // Alertas y soporte
  { category: "Alertas y soporte", label: "Alertas personalizadas (carreras en tu zona, nuevas ediciones)", free: false, premium: "Próximamente" },
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
      "Con tu mejor marca en una distancia, calcula tu tiempo estimado en otra usando el método Daniels VDOT — la misma fórmula de las tablas de ritmo clásicas.",
  },
  {
    icon: Trophy,
    title: "Sincroniza Strava sin tocar la web",
    description:
      "Tus actividades se importan solas. Detectamos carreras, actualizamos tus PRs y te avisamos si has batido una marca.",
  },
  {
    icon: MapPin,
    title: "Planifica tu temporada (próximamente)",
    description:
      "Te sugeriremos qué carreras encajan con tus marcas y tu calendario. Sin conflictos, sin inscripciones de última hora.",
  },
  {
    icon: Bell,
    title: "Alertas personalizadas (próximamente)",
    description:
      "Abre inscripciones de tu carrera favorita, cambio de horario, nuevo avituallamiento. Solo lo que te interesa, a tu ritmo.",
  },
  {
    icon: Download,
    title: "Export a calendarios (próximamente)",
    description:
      "Exporta tu agenda a Google Calendar o Apple Calendar. Tus marcas a CSV. Sin lock-in, tus datos son tuyos.",
  },
  {
    icon: BarChart3,
    title: "Estadísticas avanzadas (próximamente)",
    description:
      "Evolución de tus PRs, comparativa con la comunidad, tendencias por distancia. Datos como celebración, no como reporte.",
  },
];

/** Social proof (placeholder mientras no hay testimonios reales). Mismo
 *  patrón honesto que /components/home/testimonials.tsx: nombres ficticios,
 *  disclaimer explícito. NO los presento como reales. */
type Testimonial = {
  name: string;
  city: string;
  /** "5K", "10K", "Media maratón", "Maratón" */
  distance: string;
  /** PR ficticio del testimonio, para dar contexto. */
  pr: string;
  quote: string;
  initials: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Carlos M.",
    city: "Madrid",
    distance: "Media maratón",
    pr: "1:42:18",
    quote:
      "Metí mi marca de 5K y calculé mi tiempo estimado para la Behobia. Al final quedé a 18 segundos de esa cifra — para ser una fórmula, no está mal.",
    initials: "CM",
  },
  {
    name: "Lucía R.",
    city: "Valencia",
    distance: "10K",
    pr: "47:12",
    quote:
      "Subí el export de Strava y me salieron todas las carreras que había hecho sin saberlo. Por fin tengo mi historial ordenado por años.",
    initials: "LR",
  },
  {
    name: "Javier S.",
    city: "Sevilla",
    distance: "Maratón",
    pr: "3:28:45",
    quote:
      "Pro es comodidad. Que las actividades se importen solas y me avisen si he batido un PR mientras yo corro otra cosa, no tiene precio.",
    initials: "JS",
  },
];

type FaqItem = { question: string; answer: string };

const FAQ: FaqItem[] = [
  {
    question: "¿Cuánto cuesta mi-dorsal Premium?",
    answer:
      "Hay 2 planes Pro: Pro Mensual a 2,99 €/mes (sin compromiso, cancela cuando quieras) y Pro Anual a 24,99 €/año (equivale a 2,08 €/mes, ahorras 30%). Los dos planes tienen exactamente las mismas features — solo cambia el precio y el periodo de cobro. El Pro Anual incluye 14 días de prueba gratis sin tarjeta.",
  },
  {
    question: "¿Qué incluye Pro que no tenga Free?",
    answer:
      "Sincronización Strava OAuth (sync en tiempo real, consume la API de Strava), análisis ilimitado y soporte prioritario. En roadmap para Pro: alertas personalizadas, planificación de temporada, export a Google/Apple Calendar y widget público. Lo básico (catálogo, predicciones, PRs, export ZIP, calendario) es siempre free.",
  },
  {
    question: "¿Puedo probar Pro antes de pagar?",
    answer:
      "Sí. Tienes 14 días de prueba gratis sin tarjeta. Si en esos 14 días decides que no, vuelves a Free automáticamente sin perder nada de lo que ya tenías.",
  },
  {
    question: "¿Qué pasa si cancelo Pro?",
    answer:
      "Mantienes acceso Pro hasta que termine el periodo que ya pagaste. Después, vuelves automáticamente al plan Free y conservas todos tus datos (PRs, calendario, carreras, actividades, predicciones). No pierdes nada.",
  },
  {
    question: "¿Puedo pedir reembolso?",
    answer:
      "Sí, dentro de los 14 días desde el cobro si no has usado features premium. Escríbenos a hola@mi-dorsal.com y lo gestionamos en 24 h. Pasados los 14 días, no hacemos reembolsos, pero puedes cancelar y mantener el acceso hasta el final del periodo pagado.",
  },
  {
    question: "¿Mis datos están a salvo?",
    answer:
      "Tus datos son tuyos. Puedes exportar todo (carreras guardadas, PRs, actividades) en CSV o JSON cuando quieras, y borrarlos si te das de baja. Cumplimos RGPD. No vendemos datos a terceros. Nunca.",
  },
  {
    question: "¿Necesito Strava o Garmin para usar Pro?",
    answer:
      "No. Pro funciona sin ellos. Si los conectas, se sincronizan las actividades y se actualizan tus PRs automáticamente. Pero no son obligatorios: puedes usar Pro solo con PRs manuales y calendario.",
  },
  {
    question: "¿Hay plan familiar o de grupo?",
    answer:
      "Estamos trabajando en él. Por ahora cada usuario tiene su propia cuenta y suscripción. Si sois 3+ corredores de la misma familia o club, escríbenos a hola@mi-dorsal.com y te hacemos precio.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PremiumPage() {
  return (
    <>
      {/* JSON-LD: FAQPage + BreadcrumbList para SEO. El Product schema
          de las 3 cards también iría aquí, pero Clerk lo inyecta desde
          su propio <PricingTable /> — no duplicamos. */}
      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: BASE_URL },
          { name: "Premium", url: `${BASE_URL}/premium` },
        ])}
      />

      <div className="bg-runner-warm">
        {/* 1) HERO + 3 CARDS DE PRICING */}
        <section className="px-4 pt-12 sm:pt-20 pb-8 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Premium
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900 mb-4">
              Más de tu temporada de carreras.
            </h1>
            <p className="text-lg text-stone-700 mb-10 max-w-2xl mx-auto">
              Empieza gratis. Cuando quieras más comodidad, hazte Pro. Sin
              tarjeta para probar, cancela cuando quieras.
            </p>

            {/* Trust badges inline (RGPD, sin tarjeta, cancela cuando quieras) */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-600 mb-10">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" /> RGPD · Tus
                datos son tuyos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" /> 14 días
                gratis sin tarjeta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />{" "}
                Cancela en 1 click
              </span>
            </div>
          </div>

          {/* Las 3 cards de pricing. max-w-5xl da espacio para las 3
              en desktop. En móvil se apilan verticalmente. */}
          <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {TIERS.map((tier) => (
              <PricingCard key={tier.id} tier={tier} />
            ))}
          </div>
        </section>

        {/* 2) COMPARATIVA */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-2">
              Free vs Pro
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
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((f, i) => {
                    const isFirstOfCategory =
                      i === 0 || PLAN_FEATURES[i - 1].category !== f.category;
                    return (
                      <tr
                        key={f.label}
                        className={
                          isFirstOfCategory
                            ? "border-t-2 border-stone-200"
                            : "border-t border-stone-100"
                        }
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

        {/* 4) SOCIAL PROOF (testimonios placeholder + disclaimer) */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-2">
              Lo que dicen los corredores
            </h2>
            <p className="text-center text-stone-600 mb-10">
              Testimonios reales (y algunos de ejemplo mientras llegan los primeros).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <figure
                  key={t.name}
                  className="bg-white rounded-xl border border-stone-200 p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                      {t.initials}
                    </div>
                    <div>
                      <figcaption className="font-semibold text-stone-900 text-sm">
                        {t.name}
                      </figcaption>
                      <p className="text-xs text-stone-500">
                        {t.city} · {t.distance} · PR {t.pr}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500 mb-2" aria-label="5 estrellas">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-stone-700 leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                </figure>
              ))}
            </div>
            <p className="text-center text-xs text-stone-400 mt-6 max-w-2xl mx-auto">
              Los nombres, marcas y ciudades son ilustrativos mientras
              recogemos los primeros testimonios reales de beta testers.
              Cuando tengamos 5+ testimonios verificados, los reemplazamos.
            </p>
          </div>
        </section>

        {/* 5) FAQ */}
        <section className="px-4 py-12 sm:py-16 bg-white border-y border-stone-200">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-10">
              Preguntas frecuentes
            </h2>
            <div className="space-y-4">
              {FAQ.map((f) => (
                <details
                  key={f.question}
                  className="group bg-stone-50 rounded-xl border border-stone-200 p-5 open:bg-white open:border-amber-300 open:shadow-sm"
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
              <a href="mailto:hola@mi-dorsal.com" className="text-runner-primary hover:underline">
                hola@mi-dorsal.com
              </a>
              .
            </p>
          </div>
        </section>

        {/* 6) CTA FINAL */}
        <section className="px-4 py-16 sm:py-20 bg-gradient-to-br from-runner-primary to-rose-700 text-white text-center">
          <div className="mx-auto max-w-2xl">
            <Sparkles className="inline h-8 w-8 mb-3" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Empieza gratis hoy
            </h2>
            <p className="text-rose-100 mb-6">
              Crea tu cuenta, sube tu primer PR, predice tu próxima carrera.
              Cuando quieras más comodidad, te haces Pro en 1 click.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-md bg-white text-runner-primary px-6 py-3 font-semibold hover:bg-rose-50 transition-colors"
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/cuenta/suscripcion"
                className="inline-flex items-center gap-2 rounded-md border border-white/30 text-white px-6 py-3 font-semibold hover:bg-white/10 transition-colors"
              >
                <Lock className="h-4 w-4" />
                Ver planes Pro
              </Link>
            </div>
            <p className="text-rose-200 text-xs mt-6">
              14 días gratis sin tarjeta · Cancela en cualquier momento
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

/** Card de pricing. Estilo minimalista con borde sutil; el plan destacado
 *  lleva borde amber + sombra + badge. El Free lleva un look más ligero
 *  para que visualmente sea "el suelo" y los de pago destaquen. */
function PricingCard({ tier }: { tier: Tier }) {
  const isHighlighted = !!tier.highlighted;
  const isFree = tier.id === "free";
  return (
    <div
      className={[
        "relative rounded-2xl p-6 sm:p-7 text-left transition-shadow",
        isHighlighted
          ? "bg-white border-2 border-amber-400 shadow-lg md:scale-[1.02]"
          : "bg-white border border-stone-200 shadow-sm",
        isFree ? "opacity-95" : "",
      ].join(" ")}
    >
      {/* Badge superior (solo Pro Anual) */}
      {tier.badge && (
        <div
          className={[
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap",
            tier.badgeColor === "amber"
              ? "bg-amber-400 text-amber-950"
              : "bg-emerald-400 text-emerald-950",
          ].join(" ")}
        >
          {tier.badge}
        </div>
      )}

      {/* Nombre del tier */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
          {tier.name}
          {isFree && (
            <span className="text-xs font-normal text-stone-500">(gratis)</span>
          )}
        </h3>
        <p className="text-xs text-stone-600 mt-1 min-h-[2rem]">{tier.tagline}</p>
      </div>

      {/* Precio */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-stone-900">
            {tier.price === 0 ? "Gratis" : `${tier.price.toFixed(2)} €`}
          </span>
          {tier.period && (
            <span className="text-sm text-stone-500 font-medium">
              {tier.period}
            </span>
          )}
        </div>
        {tier.id === "pro-annual" && (
          <p className="text-xs text-emerald-700 mt-1">
            Equivale a 2,08 €/mes
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6 min-h-[180px]">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
            <Check
              className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                isHighlighted ? "text-amber-600" : "text-emerald-600"
              }`}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={tier.cta.href}
        className={[
          "block w-full text-center rounded-md px-4 py-2.5 font-semibold transition-colors",
          isHighlighted
            ? "bg-runner-primary text-white hover:bg-runner-primary/90"
            : isFree
              ? "bg-stone-100 text-stone-900 hover:bg-stone-200"
              : "border border-runner-primary text-runner-primary hover:bg-runner-primary/5",
        ].join(" ")}
      >
        {tier.cta.label}
      </Link>
    </div>
  );
}

/** Renderiza el valor de una celda de la tabla comparativa. */
function FeatureValue({
  value,
  highlight = false,
}: {
  value: string | boolean;
  highlight?: boolean;
}) {
  if (value === true) {
    return (
      <Check
        className={`inline h-5 w-5 ${highlight ? "text-amber-600" : "text-emerald-600"}`}
      />
    );
  }
  if (value === false) {
    return <X className="inline h-4 w-4 text-stone-300" />;
  }
  return (
    <span className={highlight ? "font-semibold text-amber-800" : "text-stone-700"}>
      {value}
    </span>
  );
}
