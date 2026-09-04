"use client";

/**
 * TrustBar — barra de cifras con social proof numérico.
 *
 * Números BAJOS y honestos (estamos empezando). La honestidad convierte mejor
 * que los números inflados. Usamos "≈" para indicar que son aproximados.
 *
 * Si en el futuro los números crecen, solo hay que tocar este array.
 */

import { Flag, Users, Mail, Trophy } from "lucide-react";

interface Stat {
  icon: React.ElementType;
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { icon: Flag, value: "≈ 1.200", label: "carreras en el catálogo" },
  { icon: Users, value: "17", label: "comunidades autónomas" },
  { icon: Trophy, value: "≈ 280", label: "dorsales rastreados" },
  { icon: Mail, value: "≈ 60", label: "resultados enviados" },
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
                <p className="text-xl md:text-2xl font-bold text-runner-dark leading-tight">
                  {stat.value}
                </p>
                <p className="text-xs md:text-sm text-gray-600 leading-tight">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
        Empezamos en 2026. Somos una comunidad pequeña en crecimiento, pero los que ya están
        dentro no se van. 💪
      </p>
    </section>
  );
}
