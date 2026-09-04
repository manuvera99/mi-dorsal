/**
 * Testimonials — voces de la comunidad.
 *
 * En MVP no tenemos testimonios reales, así que el componente:
 *  1. Muestra 3 testimonios placeholder CLARAMENTE marcados como
 *     "perfiles de la primera hornada, nombre ficticio" con un disclaimer
 *     visible.
 *  2. La honestidad aquí es estrategia: si alguien intenta comprar y ve
 *     testimonios falsos, perdemos la confianza para siempre.
 *
 * Cuando lleguen testimonios reales, solo se sustituye el array.
 */

import { Quote } from "lucide-react";

interface Testimonial {
  name: string;
  age: number;
  city: string;
  race: string;
  time: string;
  text: string;
  avatar: string; // emoji o inicial
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
        <p className="text-sm text-gray-600 mt-2 max-w-xl mx-auto">
          Estamos empezando, así que estos testimonios son placeholders de la primera
          hornada. Los reales llegan cuando los primeros 200 corredores los escriban.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {TESTIMONIALS.map((t) => (
          <article
            key={t.name}
            className="relative rounded-2xl bg-white border border-gray-200 p-5 md:p-6"
          >
            <Quote
              className="absolute -top-3 -left-2 h-8 w-8 text-runner-primary bg-white rounded-full p-1.5"
              aria-hidden="true"
            />
            <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4 italic">
              &ldquo;{t.text}&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <div
                className="h-10 w-10 rounded-full bg-runner-warm border border-gray-200 flex items-center justify-center text-lg"
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

      <p className="text-center text-[11px] text-gray-500 mt-6 max-w-2xl mx-auto leading-relaxed">
        <span aria-hidden="true">⚠️</span> Testimonios placeholder pendientes de validar con
        corredores reales. Cuando tengamos los primeros 200, los sustituimos. No nos gusta mentir,
        ni siquiera en el onboarding.
      </p>
    </section>
  );
}
