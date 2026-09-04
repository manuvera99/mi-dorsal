"use client";

/**
 * CommunityRanking — top 3 carreras votadas por la comunidad.
 *
 * Recibe el array del backend y renderiza 3 cards destacadas con 🥇🥈🥉.
 * El CTA lleva al top 10 completo.
 */

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useApiQuery } from "@/components/useApiOrMock";
import { api } from "@/convex/_generated/api";
import { mockApi } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export function CommunityRanking() {
  const top = useApiQuery(
    api.ratings.topRaces as any,
    { limit: 10 },
    () => mockApi.ratings.topRaces({ limit: 10 })
  );

  const top3 = Array.isArray(top) ? top.slice(0, 3) : [];
  const hasMore = Array.isArray(top) && top.length > 3;
  const loading = top === undefined;

  return (
    <section className="py-8 md:py-10" aria-labelledby="ranking-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-sm font-semibold text-runner-primary uppercase tracking-wider mb-1 flex items-center gap-2">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Ranking comunidad
          </p>
          <h2 id="ranking-title" className="text-2xl md:text-3xl font-bold text-runner-dark">
            Las carreras mejor valoradas
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Votadas en tiempo real por corredores como tú. Mínimo 3 votos para entrar al top.
          </p>
        </div>
        {hasMore && (
          <Link
            href="/ranking"
            className="text-sm font-semibold text-runner-primary hover:underline inline-flex items-center gap-1"
          >
            Ver top 10
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-lg border border-gray-200 bg-white animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : top3.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-runner-warm p-8 text-center">
          <p className="text-base font-semibold text-runner-dark mb-1">
            El ranking está en pañales.
          </p>
          <p className="text-sm text-gray-600">
            Sé el primero en votar: entra a una carrera y desliza los 8 sliders. ⭐
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((race: any, i: number) => (
            <div key={race._id} className="relative">
              <span
                className="absolute -top-2 -left-2 text-3xl z-10 drop-shadow"
                aria-hidden="true"
              >
                {MEDALS[i]}
              </span>
              <RaceCard race={race} showAverage avgGlobal={race.avgGlobal} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
