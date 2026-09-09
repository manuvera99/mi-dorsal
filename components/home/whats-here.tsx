/**
 * WhatsHere — "Lo que ya puedes hacer con mi-dorsal".
 *
 * A diferencia de `Features` (que habla en términos aspiracionales y
 * emocionales), esta sección es PRAGMÁTICA: lista lo que el producto hace
 * HOY, sin humo, con un ejemplo concreto al lado de cada capacidad.
 *
 * El objetivo es quitar la objeción "¿y esto realmente funciona o es
 * otra promesa vacía?" con hechos, no con adjetivos.
 *
 * NO es una sección redundante con Features: Features promete
 * experiencias, WhatsHere demuestra capacidades. La copla está en que
 * ambas coexistan: emocional + racional.
 */

import {
  Search,
  Timer,
  Vote,
  Mail,
  Calendar,
  Trophy,
  type LucideIcon,
} from "lucide-react";

interface Capability {
  icon: LucideIcon;
  emoji: string;
  title: string;
  body: string;
  example: string;
}

const CAPABILITIES: Capability[] = [
  {
    icon: Search,
    emoji: "🔍",
    title: "Catálogo de toda España, actualizado a diario",
    body:
      "Más de 1.400 carreras de 17 comunidades, scraped de RFEA, FEDME, ITRA, Sportmaniacs, Runedia y webs de organizadores.",
    example: "Behobia · San Silvestre Vallecana · 10K Valencia · Maratón Sevilla · Trail de Tenerife",
  },
  {
    icon: Timer,
    emoji: "⏱️",
    title: "Predicción de tiempo en cada carrera (Daniels VDOT)",
    body:
      "Mete tu mejor marca en 5K, 10K o media y calcula tu tiempo estimado en cualquier otra distancia. Mismo cálculo (Daniels VDOT) que usan muchas tablas de ritmo.",
    example: "PR en 10K: 44:21 → predicción en media maratón: 1h 38′ ± 4%",
  },
  {
    icon: Vote,
    emoji: "⭐",
    title: "Votación 8D de la comunidad (top 10 manda)",
    body:
      "8 sliders de 0 a 10: organización, avituallamiento, bolsa del corredor, ambiente, recorrido, post-carrera, premios. Mínimo 3 votos para entrar al ranking.",
    example: "Las 8D más votadas del mes → /ranking",
  },
  {
    icon: Mail,
    emoji: "📬",
    title: "Resultados oficiales por email + diploma PDF",
    body:
      "Cuando el organizador publica clasificaciones, te llega un email con tu tiempo, posición, comparativa con tu predicción y un diploma descargable.",
    example: "Tu Behobia: 1h 26′ 14″ · diploma PDF adjunto · compártelo con tu club",
  },
  {
    icon: Calendar,
    emoji: "🗓️",
    title: "Calendario personal con dorsales y predicciones",
    body:
      "Todas tus carreras planeadas en un sitio, con dorsal, fecha, lugar y predicción. Recordatorio 7 días antes y la noche antes.",
    example: "Tu temporada 2026 → 6 carreras · 3 con dorsal ya puesto",
  },
  {
    icon: Trophy,
    emoji: "🏆",
    title: "PRs manuales + import desde Strava (ZIP)",
    body:
      "Añade tus marcas a mano o sube el export de Strava una vez. Detectamos carreras, actualizamos PRs y te avisamos si has batido una marca.",
    example: "Export 2024 subido · 312 actividades · 4 PRs nuevos detectados",
  },
];

export function WhatsHere() {
  return (
    <section
      className="py-8 md:py-12"
      aria-labelledby="whats-here-title"
    >
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2">
          Lo que ya está funcionando
        </p>
        <h2
          id="whats-here-title"
          className="text-3xl md:text-4xl font-bold text-runner-dark"
        >
          Esto es lo que tienes al registrarte
        </h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          Sin promesas, sin roadmap. Cosas que ya están hechas y que
          puedes usar hoy, gratis.
        </p>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          return (
            <li
              key={c.title}
              className="group relative rounded-2xl bg-white border border-gray-200 p-5 md:p-6 hover:border-runner-primary/40 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-runner-warm text-runner-primary group-hover:bg-runner-primary group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-runner-dark mb-1.5 flex items-start gap-2">
                    <span aria-hidden="true">{c.emoji}</span>
                    <span>{c.title}</span>
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {c.body}
                  </p>
                  <p className="text-xs font-mono text-gray-500 leading-relaxed border-l-2 border-runner-primary/30 pl-3">
                    {c.example}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
