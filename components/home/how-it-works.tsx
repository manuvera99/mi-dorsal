/**
 * HowItWorks — 3 pasos visuales.
 *
 * Sección con fondo oscuro (asfalto-700 del rediseño, aproximado con gray-900)
 * para romper la monotonía. Tipografía clara sobre contraste alto.
 *
 * Cada paso tiene: número grande, icono, título y 2 líneas de copy.
 */

import { Search, Hash, Inbox } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    number: "1",
    icon: Search,
    title: "Encuentra tu carrera",
    body: "Filtra por comunidad, fecha, distancia o tipo. Más de 1.200 carreras populares actualizadas a diario.",
  },
  {
    number: "2",
    icon: Hash,
    title: "Añádela a tu temporada",
    body: "Mete tu dorsal y el día D te enviamos recordatorio 7 días antes y la noche de antes. Sin excusas para olvidarla.",
  },
  {
    number: "3",
    icon: Inbox,
    title: "Recibe tu resultado oficial",
    body: "Cuando la carrera publica clasificaciones, te llega el email con tu tiempo, posición y diploma PDF.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white px-6 py-12 md:px-12 md:py-16"
      aria-labelledby="how-title"
    >
      <div className="text-center mb-10 md:mb-12">
        <p className="text-sm font-semibold text-red-300 uppercase tracking-wider mb-2">
          3 pasos · 0 complicaciones
        </p>
        <h2 id="how-title" className="text-3xl md:text-4xl font-bold leading-tight">
          De cero a tu diploma en 3 pasos
        </h2>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
        {/* Línea conectora en desktop */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
        />

        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.number} className="relative">
              <div className="flex items-center gap-4 mb-4">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-runner-primary text-white text-2xl font-bold shadow-lg shadow-red-900/50"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <Icon className="h-7 w-7 text-red-300" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold mb-2 leading-tight">{step.title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{step.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="text-center mt-10">
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-md hover:bg-red-50 transition-colors"
        >
          Empieza tu temporada gratis
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
