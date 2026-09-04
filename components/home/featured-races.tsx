"use client";

/**
 * FeaturedRaces — sección de carreras destacadas del mes.
 *
 * Estrategia de personalización geográfica (3 niveles):
 *  1. Si hay comunidad detectada (IP o manual): muestra primero carreras
 *     de esa comunidad, luego rellena con nacionales.
 *  2. Si no: muestra las "isFeatured" globales (las del admin).
 *  3. Si no hay featured: muestra las 6 más próximas en fecha.
 *
 * Usa useApiQuery (mock + real en uno).
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { RaceCard } from "@/components/race-card";
import { useApiQuery } from "@/components/useApiOrMock";
import { api } from "@/convex/_generated/api";
import { mockApi } from "@/lib/mock/provider";
import { useUserRegion } from "@/components/use-user-region";

const LIMIT = 6;

export function FeaturedRaces() {
  const { community } = useUserRegion();

  const races = useApiQuery(
    api.races.getFeatured as any,
    { limit: 50 },
    () => mockApi.races.getFeatured({ limit: 50 })
  );

  // Reordena: primero carreras de la comunidad del usuario, luego el resto.
  const ordered = useMemo(() => {
    const list = Array.isArray(races) ? races : [];
    if (list.length === 0) return list;
    if (!community) return list.slice(0, LIMIT);
    const inCommunity = list.filter((r: any) =>
      community.provinces.includes((r.province ?? "").toLowerCase())
    );
    const rest = list.filter(
      (r: any) => !community.provinces.includes((r.province ?? "").toLowerCase())
    );
    return [...inCommunity, ...rest].slice(0, LIMIT);
  }, [races, community]);

  const loading = races === undefined;
  const sectionTitle = community
    ? `Cerca de ti · ${community.shortName}`
    : "Las que más molan este mes";

  return (
    <section className="py-8 md:py-10" aria-labelledby="featured-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-1">
            Carreras destacadas
          </p>
          <h2
            id="featured-title"
            className="text-2xl md:text-3xl font-bold text-runner-dark flex items-center gap-2 flex-wrap"
          >
            {community && <MapPin className="h-6 w-6 text-runner-primary" aria-hidden="true" />}
            {sectionTitle}
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            {community
              ? `Carreras en ${community.name} y, si no hay suficientes, las mejores del resto de España.`
              : "Las que más vota la comunidad. Elige tu comunidad arriba para ver las que tienes cerca."}
          </p>
        </div>
        <Link
          href="/carreras"
          className="text-sm font-semibold text-runner-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"
        >
          Ver todas las carreras
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : ordered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordered.map((race: any) => (
            <RaceCard key={race._id} race={race} />
          ))}
        </div>
      )}
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white p-5 h-48 animate-pulse"
          aria-hidden="true"
        >
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-6" />
          <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-runner-warm p-8 text-center">
      <p className="text-base font-semibold text-runner-dark mb-1">
        Todavía no hay carreras destacadas este mes.
      </p>
      <p className="text-sm text-gray-600 mb-4">
        Estamos terminando de cargar el calendario. Vuelve en unos días o explora el catálogo.
      </p>
      <Link
        href="/carreras"
        className="inline-flex items-center gap-1 text-sm font-semibold text-runner-primary hover:underline"
      >
        Ir al catálogo completo
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
