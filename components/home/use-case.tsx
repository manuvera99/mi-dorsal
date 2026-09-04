/**
 * UseCase — "Imagina: te has apuntado a la Behobia".
 *
 * Storytelling > lista de features. Mostramos 3 momentos reales del
 * journey del usuario con mockups de los emails que recibiría.
 *
 * El objetivo: que el visitante se imagine usando la app.
 */

import { Mail, Calendar, Trophy } from "lucide-react";

const MOMENTS = [
  {
    icon: Calendar,
    when: "Enero. Abres midorsal.",
    body: "Las 6 carreras que has marcado este año están ahí, con tu dorsal 4213. La Behobia, la San Silvestre, la media de tu ciudad. Todo en una pantalla.",
  },
  {
    icon: Mail,
    when: "Noviembre, 7 días antes.",
    body: "Te llega un email: \"Faltan 7 días para la Behobia. Tu predicción: 1h 28'. ¿Vas a por el sub-1:30?\". Lo lees mientras atas las zapatillas.",
  },
  {
    icon: Trophy,
    when: "Noviembre, el día después.",
    body: "Resultado oficial publicado: 1h 26' 14\". Nuevo PR. El diploma PDF ya está en tu buzón. Lo compartes en el grupo de WhatsApp del club. 🎉",
  },
];

export function UseCase() {
  return (
    <section className="py-8 md:py-12" aria-labelledby="usecase-title">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2">
          Caso real
        </p>
        <h2 id="usecase-title" className="text-3xl md:text-4xl font-bold text-runner-dark">
          Imagina: te apuntas a la Behobia.
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Columna izquierda: narrativa */}
        <ol className="lg:col-span-3 space-y-6">
          {MOMENTS.map((m, i) => {
            const Icon = m.icon;
            return (
              <li key={i} className="flex gap-4 items-start group">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-runner-primary text-white shadow-md group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  {i < MOMENTS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="w-0.5 flex-1 bg-gradient-to-b from-runner-primary/40 to-transparent mt-2 mb-2 min-h-[40px]"
                    />
                  )}
                </div>
                <div className="pt-1">
                  <p className="text-base font-semibold text-runner-primary mb-1">{m.when}</p>
                  <p className="text-base text-gray-700 leading-relaxed">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Columna derecha: mockups de emails */}
        <div className="lg:col-span-2 space-y-4">
          <EmailMockup
            label="T-7 días · recordatorio"
            title="Faltan 7 días para la Behobia"
            body="Tu predicción: 01:28:00. ¿Vas a por el sub-1:30? Salida a las 17:00 desde el Boulevard."
            footer="mi-dorsal · Behotiburu, esto va en serio"
          />
          <EmailMockup
            label="Día D+1 · resultado oficial"
            title="🏁 Tu Behobia: 01:26:14"
            body="Has batido tu marca en 1:52. Diploma PDF adjunto. Comparte con tu club."
            footer="mi-dorsal · Nuevo PR desbloqueado 🎉"
            highlight
          />
        </div>
      </div>
    </section>
  );
}

interface EmailMockupProps {
  label: string;
  title: string;
  body: string;
  footer: string;
  highlight?: boolean;
}

function EmailMockup({ label, title, body, footer, highlight }: EmailMockupProps) {
  return (
    <div
      className={`rounded-xl border ${
        highlight ? "border-runner-primary/50 shadow-lg" : "border-gray-200 shadow-sm"
      } bg-white overflow-hidden`}
    >
      <div
        className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
          highlight ? "bg-runner-primary text-white" : "bg-runner-warm text-gray-600"
        }`}
      >
        {label}
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-runner-dark mb-1.5">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">{body}</p>
        <p className="text-[11px] text-gray-400 italic">{footer}</p>
      </div>
    </div>
  );
}
