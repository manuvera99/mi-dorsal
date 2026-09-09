/**
 * Testimonials — voces de la comunidad.
 */

import { Quote, Sparkles } from "lucide-react";

interface Testimonial {
  name: string;
  age: number;
  city: string;
  race: string;
  time: string;
  text: string;
  avatar: string; // emoji o inicial
  /** Si true, se renderiza con accent dorado (testimonial de Pro). */
  pro?: boolean;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Carlos M.",
    age: 38,
    city: "Valencia",
    race: "10K Valencia 2026",
    time: "44:21",
    text: "Por fin alguien que entiende que el dorsal importa más que el pace medio del entrenamiento. Que me manden el resultado al buzón es la hostia.",
    avatar: "🏃",
  },
  {
    name: "Lucía R.",
    age: 31,
    city: "Madrid",
    race: "Media Maratón Madrid 2026",
    time: "1:42:08",
    text: "Me apunté a 6 carreras este año y las tengo todas aquí. No más capturas de WhatsApp con la fecha y el dorsal apuntados a mano.",
    avatar: "🧡",
  },
  {
    name: "Roberto S.",
    age: 45,
    city: "Bilbao",
    race: "Behobia 2025",
    time: "1:26:14",
    text: "Recibir el diploma en PDF al cruzar la meta es de las mejores cosas que he visto en una app. Lo mandé al grupo del club en 2 minutos.",
    avatar: "⚡",
  },
  {
    name: "Nerea P.",
    age: 34,
    city: "Sevilla",
    race: "Maratón Sevilla 2026",
    time: "3:48:12",
    text: "Por 2,99 € al mes me ahorro el dolor de cabeza de exportar Strava a mano. Mis PRs se actualizan solos y el analisis de tu perfil de corredor me dice dónde apretar. Vale mucho más de lo que cuesta.",
    avatar: "✨",
    pro: true,
  },
];

export function Testimonials() {
  return (
    <section
      className="py-8 md:py-12 bg-runner-warm rounded-3xl px-5 md:px-10"
      aria-labelledby="testimonials-title"
    >
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2">
          Voces de la comunidad
        </p>
        <h2
          id="testimonials-title"
          className="text-3xl md:text-4xl font-bold text-runner-dark"
        >
          Lo que dicen los que ya están dentro
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {TESTIMONIALS.map((t) => (
          <article
            key={t.name}
            className={`relative rounded-2xl border p-5 md:p-6 ${
              t.pro
                ? "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200"
                : "bg-white border-gray-200"
            }`}
          >
            <Quote
              className="absolute -top-3 -left-2 h-8 w-8 text-runner-primary bg-white rounded-full p-1.5"
              aria-hidden="true"
            />
            {t.pro && (
              <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-yellow-300 text-runner-dark px-2 py-0.5 border border-yellow-400">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Pro
              </span>
            )}
            <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4 italic">
              &ldquo;{t.text}&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <div
                className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-lg"
                aria-hidden="true"
              >
                {t.avatar}
              </div>
              <div className="text-sm">
                <p className="font-semibold text-runner-dark">
                  {t.name}, {t.age}
                </p>
                <p className="text-xs text-gray-500">{t.city}</p>
                <p className="text-[11px] text-runner-primary font-mono mt-0.5">
                  {t.race} · {t.time}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
