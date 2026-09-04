/**
 * Problem — "¿Te suena esto?"
 *
 * Tres cards con situaciones reconocibles por el corredor popular.
 * Conecta con el dolor antes de presentar la solución.
 *
 * Tono: cercano, con humor de corredor, en primera persona.
 */

import { CalendarDays, Smartphone, Search } from "lucide-react";

const PROBLEMS = [
  {
    icon: CalendarDays,
    title: "El calendario de las dudas",
    text: "Apunté 4 carreras en diciembre. En marzo ya no sabía cuál era cuál. ¿Y el dorsal? Eso ya ni te cuento.",
  },
  {
    icon: Smartphone,
    title: "El tiempo oficial, versión fantasma",
    text: "Crucé la meta, miré el reloj, vi un 1:26:14. Luego el de la app del organizador, otro. Y el definitivo… ¿dónde está?",
  },
  {
    icon: Search,
    title: "El excel casero de la vergüenza",
    text: "Llevas tus PRs en una nota del móvil, entre la lista de la compra y el código de la alarma. Funciona, pero no mola.",
  },
];

export function Problem() {
  return (
    <section className="py-8 md:py-12" aria-labelledby="problem-title">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2">
          Empatía
        </p>
        <h2
          id="problem-title"
          className="text-3xl md:text-4xl font-bold text-runner-dark"
        >
          ¿Te suena esto?
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PROBLEMS.map((p) => {
          const Icon = p.icon;
          return (
            <article
              key={p.title}
              className="rounded-2xl bg-white border border-gray-200 p-6 hover:border-runner-primary/30 transition-colors"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-runner-warm text-runner-primary mb-4">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-runner-dark">{p.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{p.text}</p>
            </article>
          );
        })}
      </div>

      <p className="text-center text-base md:text-lg text-gray-700 mt-8 max-w-xl mx-auto">
        Si has dicho <span className="font-semibold text-runner-primary">"sí, sí, sí"</span> a
        alguna, esto es para ti. ↓
      </p>
    </section>
  );
}
