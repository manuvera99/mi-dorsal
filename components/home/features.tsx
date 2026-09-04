/**
 * Features — 4 columnas grandes con los "superpoderes" de la app.
 *
 * Cada feature: icono grande, título y 2-3 líneas de copy. Tono con humor
 * sutil de corredor (sin pasarse, para no cansar).
 */

import { Timer, Star, CalendarDays, Mail } from "lucide-react";

const FEATURES = [
  {
    icon: Timer,
    title: "Predice tu tiempo en cada carrera",
    body: "Mete tu marca en 5K, 10K o media. Calculamos tu tiempo probable en cualquier distancia con el método Daniels VDOT. Acierta en un 4% de media.",
    emoji: "⏱️",
  },
  {
    icon: Star,
    title: "Vota con 8 sliders (como los pro)",
    body: "Organización, avituallamiento, bolsa del corredor, ambiente… El top 10 de la comunidad manda, no el algoritmo.",
    emoji: "⭐",
  },
  {
    icon: CalendarDays,
    title: "Tu temporada en una pantalla",
    body: "Mira todas tus carreras planeadas con dorsal, fecha, lugar y predicción. Sin excels. Sin notas del móvil. Sin capturas de WhatsApp.",
    emoji: "🗓️",
  },
  {
    icon: Mail,
    title: "Resultados en tu buzón",
    body: "Cuando se publican las clasificaciones, te llega el email con tu tiempo, diploma PDF y comparativa con tu predicción. Sin volver a la web del organizador.",
    emoji: "📬",
  },
];

export function Features() {
  return (
    <section className="py-8 md:py-12" aria-labelledby="features-title">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2">
          Funciones
        </p>
        <h2 id="features-title" className="text-3xl md:text-4xl font-bold text-runner-dark">
          Lo que te llevas
        </h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          Lo que nos hubiera gustado tener a nosotros cuando empezamos a correr populares. Sin
          extras de adorno.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="group rounded-2xl bg-white border border-gray-200 p-5 md:p-6 hover:border-runner-primary/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-runner-warm text-runner-primary group-hover:bg-runner-primary group-hover:text-white transition-colors"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span aria-hidden="true" className="text-2xl">
                  {feature.emoji}
                </span>
              </div>
              <h3 className="font-semibold text-base text-runner-dark mb-2 leading-snug">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{feature.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
