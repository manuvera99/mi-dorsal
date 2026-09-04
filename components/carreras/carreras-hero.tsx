"use client";

/**
 * CarrerasHero — cabecera de la página /carreras.
 *
 * Mucho más compacto que el de la home, pero con la misma jerarquía de
 * marketing:
 *  - Eyebrow: contexto ("Catálogo completo · actualizado a diario")
 *  - H1: claro y con gancho SEO ("Carreras populares en España")
 *  - Subtítulo: beneficios clave, no jerga
 *  - Contador en vivo: número de carreras por comunidad detectada
 *  - Buscador destacado con CTA
 *  - Trust signals: RFEA, FEDME, federaciones
 *
 * NO muestra CTAs de registro: la home ya los tiene. Aquí la misión
 * es que el visitante encuentre SU carrera y se quede.
 */

import { useState, useEffect } from "react";
import { Search, Calendar, MapPin, Sparkles } from "lucide-react";
import { useUserRegion } from "@/components/use-user-region";
import { cn } from "@/lib/utils";

interface CarrerasHeroProps {
  totalRaces: number;
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export function CarrerasHero({ totalRaces, onSearch, initialQuery = "" }: CarrerasHeroProps) {
  const { community, loading } = useUserRegion();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== initialQuery) onSearch(query);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const isFiltered = !!community && !loading;

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-runner-warm via-white to-runner-warm border border-gray-200"
      aria-labelledby="carreras-hero-title"
    >
      <div className="relative px-5 py-8 md:px-10 md:py-12">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-runner-primary uppercase tracking-wider mb-3">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Catálogo completo · actualizado a diario
          </p>

          <h1
            id="carreras-hero-title"
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-runner-dark leading-[1.1] mb-3 tracking-tight"
          >
            {isFiltered ? (
              <>
                Carreras populares en{" "}
                <span className="text-runner-primary">{community!.shortName}</span>
              </>
            ) : (
              <>Carreras populares en toda España</>
            )}
          </h1>

          <p className="text-base md:text-lg text-gray-700 leading-relaxed mb-6 max-w-2xl">
            Más de <strong className="text-runner-dark">{totalRaces.toLocaleString("es-ES")}</strong>{" "}
            carreras de running, trail, asfalto y obstáculos. Filtra por distancia, mes, ciudad o
            tipo. Vota las que ya corriste y predice el tiempo en las que te apuntaste.
          </p>

          {/* Buscador grande */}
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(query);
            }}
            className="relative max-w-2xl mb-5"
          >
            <label htmlFor="carreras-search" className="sr-only">
              Buscar carreras
            </label>
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="carreras-search"
              type="search"
              placeholder={
                isFiltered
                  ? `Buscar en ${community!.name} o en toda España…`
                  : "Buscar por nombre, ciudad u organizadora…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                "w-full h-14 pl-12 pr-4 rounded-2xl text-base",
                "bg-white border-2 border-gray-200",
                "focus:border-runner-primary focus:outline-none focus:ring-4 focus:ring-runner-primary/10",
                "placeholder:text-gray-400 transition-all"
              )}
              autoComplete="off"
            />
          </form>

          {/* Trust signals */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
            <li className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-runner-primary" aria-hidden="true" />
              <span>
                Calendarios 2026 y 2027. Apertura de inscripciones en cada ficha.
              </span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-runner-primary" aria-hidden="true" />
              <span>17 comunidades autónomas · 50 provincias</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
