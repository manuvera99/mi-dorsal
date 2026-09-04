"use client";

/**
 * FAQ — preguntas frecuentes, acordeón accesible.
 *
 * 8 preguntas matando las objeciones más comunes. Marca con `+` o `-` el
 * estado del acordeón, soporta teclado (Enter/Espacio) y tiene
 * aria-expanded para lectores de pantalla.
 *
 * Las preguntas se exportan también para que la página genere el schema
 * FAQPage (Google rich results).
 */

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "¿Cuánto cuesta mi-dorsal?",
    answer:
      "Gratis. Sin tarjeta, sin premium, sin truco. Creemos que el corredor popular no debería pagar por no perder su dorsal. Cuando llegue el momento,可能会有一些高级功能 para clubs y organizadores, pero la app del corredor siempre será gratis.",
  },
  {
    question: "¿De dónde sacáis las carreras?",
    answer:
      "Scraping ético de fuentes oficiales y públicas: RFEA, FEDME, ITRA, Sportmaniacs, Runedia, webs de organizadores y colaboraciones con federaciones autonómicas. Revisamos a diario. Si ves algo que falta, dínoslo y lo añadimos en menos de 48h.",
  },
  {
    question: "¿Y si mi carrera no está en el catálogo?",
    answer:
      "Dínoslo desde la sección Carreras → 'No encuentro mi carrera' y la añadimos. También puedes sugerirla tú mismo si eres el organizador.",
  },
  {
    question: "¿Cómo sabéis mi tiempo en una carrera?",
    answer:
      "Cuando el organizador publica las clasificaciones oficiales, nuestro sistema las lee y te busca por tu dorsal. Te llega un email con tu tiempo, diploma PDF y comparativa con tu predicción. Tú no tienes que hacer nada.",
  },
  {
    question: "¿Mis datos están seguros?",
    answer:
      "Sí. Servidores en la UE, cumplimiento RGPD total, política de privacidad clara y sin compartir nada con terceros. Nunca vendemos datos. Nunca.",
  },
  {
    question: "¿Tenéis app móvil nativa?",
    answer:
      "Aún no, pero la web funciona como PWA: puedes añadirla a la pantalla de inicio de tu móvil y abrirla como si fuera una app. La nativa para iOS y Android está en el roadmap para 2026.",
  },
  {
    question: "¿Funciona con Strava o Garmin?",
    answer:
      "Hoy son independientes: tú metes tu dorsal y nosotros seguimos tu resultado oficial. La sincronización con Strava (lectura de activities y VO2max) está en desarrollo (Ola 2). Te avisamos a todos los usuarios cuando esté lista.",
  },
  {
    question: "¿Puedo compartir mi temporada con mi club?",
    answer:
      "Sí, cada perfil tiene URL pública. Pronto añadiremos perfiles de club y comparativas entre miembros: 'Carlos, tu media maratón es la 7ª más rápida del club este año'.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-8 md:py-12" aria-labelledby="faq-title">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-2">
          Preguntas frecuentes
        </p>
        <h2 id="faq-title" className="text-3xl md:text-4xl font-bold text-runner-dark">
          Las dudas que te pueden estar dando vueltas
        </h2>
      </div>

      <div className="max-w-3xl mx-auto divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 md:px-6 md:py-5 hover:bg-runner-warm/50 focus-visible:bg-runner-warm/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runner-primary focus-visible:ring-inset transition-colors"
                >
                  <span className="font-semibold text-runner-dark text-sm md:text-base">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full",
                      isOpen ? "bg-runner-primary text-white" : "bg-runner-warm text-runner-primary"
                    )}
                  >
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-trigger-${i}`}
                hidden={!isOpen}
                className="px-5 md:px-6 pb-5 text-sm md:text-base text-gray-700 leading-relaxed"
              >
                {item.answer}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
