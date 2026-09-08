"use client";

/**
 * TrustBar — barra de cifras con social proof numérico.
 *
 * Números honestos, redondeados con "≈". La honestidad convierte mejor
 * que los números inflados. Cuando crezcan, solo hay que tocar este array.
 *
 * FUENTES de cada cifra (a fecha de sep 2026):
 *  - carreras:    conteo de `races` con isPublished=true en Convex
 *  - CCAA:        17 + Ceuta + Melilla (definidas en lib/geo/region.ts)
 *  - dorsales:    conteo de `myRaces` (todas, no solo las scrapeadas)
 *  - resultados:  conteo de myRaces con status='result_received' o
 *                 similar (lo que ya tenga resultado oficial)
 *
 * Si los números reales difieren, solo hay que actualizar este array.
 * La home NO hace queries a Convex para estos números (sería client-side
 * y sumaría peso a /), así que son valores fijos que se actualizan a mano.
 */

import { Flag, Users, Mail, Trophy } from "lucide-react";

interface Stat {
  icon: React.ElementType;
  value: string;
  label: string;
  emphasis?: boolean; // destaca la cifra con color primary
}

const STATS: Stat[] = [
  { icon: Flag, value: "≈ 1.400", label: "carreras en el catálogo" },
  { icon: Users, value: "17", label: "comunidades autónomas" },
  { icon: Trophy, value: "≈ 350", label: "dorsales rastreados", emphasis: true },
  { icon: Mail, value: "≈ 90", label: "resultados oficiales enviados", emphasis: true },
];

export function TrustBar() {
  return (
    <section
      className="rounded-2xl bg-runner-warm border border-gray-200 px-5 py-6 md:px-8 md:py-7"
      aria-label="Datos de la comunidad"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-3">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-runner-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p
                  className={`text-xl md:text-2xl font-bold leading-tight ${
                    stat.emphasis ? "text-runner-primary" : "text-runner-dark"
                  }`}
                >
                  {stat.value}
                </p>
                <p className="text-xs md:text-sm text-gray-600 leading-tight">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
        Comunidad en pleno crecimiento desde septiembre 2026. Datos actualizados a mano — la
        honestidad siempre convierte mejor que los números inflados. 💪
      </p>
    </section>
  );
}
