// =============================================================================
// mi-dorsal — /newsletter (landing pública de suscripción)
// =============================================================================
// Página de captación de suscriptores externos. Explica qué es la newsletter,
// qué recibirá el suscriptor, y tiene el formulario de suscripción.
// =============================================================================

import type { Metadata } from "next";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { Mail, BookOpen, ShieldCheck, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.mi-dorsal.com";

export const metadata: Metadata = {
  title: "Newsletter · mi-dorsal",
  description:
    "Una vez al mes, la mejor historia de dorsal del blog, una guía práctica y un dato curioso del running popular. Sin spam, sin postureo.",
  alternates: { canonical: "/newsletter" },
  openGraph: {
    title: "Newsletter · Historias de dorsal",
    description:
      "Una vez al mes, lo mejor del running popular. Sin spam, sin postureo.",
    type: "website",
    url: "/newsletter",
  },
  keywords: [
    "newsletter running",
    "newsletter running España",
    "newsletter mi-dorsal",
    "blog running newsletter",
  ],
};

export default function NewsletterPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-runner-warm to-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-runner-primary mb-3">
            <Mail className="h-3.5 w-3.5" /> Newsletter mi-dorsal
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            Una vez al mes, lo que merece la pena
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            La mejor historia de dorsal del mes, una guía práctica para tu
            próxima carrera y un dato curioso. Sin spam, sin patrocinios,
            sin prisa.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <NewsletterForm source="landing" variant="default" />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold mb-6 text-center">Qué recibes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ValueProp
            icon={BookOpen}
            title="1 historia real"
            description="Reportajes de carreras, perfiles de corredores populares, crónicas de meta. Sin postureo."
          />
          <ValueProp
            icon={Calendar}
            title="1 guía práctica"
            description="Cada mes, algo que te ayuda a preparar mejor tu próxima carrera: ruta, avituallamiento, material."
          />
          <ValueProp
            icon={ShieldCheck}
            title="Sin spam, sin venta"
            description="Cero afiliado, cero patrocinio. Solo contenido. Doble opt-in y baja con un click en cualquier email."
          />
        </div>
      </section>

      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-600">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">¿Quién está detrás?</h2>
          <p>
            <strong className="text-gray-900">mi-dorsal</strong> es la web app
            para corredores populares de España. Catálogo de carreras,
            predicción de tiempos y envío del resultado oficial por email. La
            newsletter es un proyecto editorial hermano: lo que no cabe en la
            app, cabe aquí.
          </p>
        </div>
      </section>
    </>
  );
}

function ValueProp({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-runner-primary/10 text-runner-primary mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}
