"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";
import { Trophy, Medal } from "lucide-react";

function MockRanking() {
  const [top, setTop] = useState<any[]>([]);
  useEffect(() => {
    mockApi.ratings.topRaces({ limit: 10 }).then(setTop);
  }, []);
  return <RankingContent top={top} />;
}

function RealRanking() {
  const convexTop = useQuery(api.ratings.topRaces, { limit: 10 });
  return <RankingContent top={(convexTop as any) ?? []} />;
}

export default function RankingPage() {
  const useMock = isMockMode();
  return useMock ? <MockRanking /> : <RealRanking />;
}

function RankingContent({ top }: { top: any[] }) {

  const getMedal = (pos: number) => {
    if (pos === 1) return "🥇";
    if (pos === 2) return "🥈";
    if (pos === 3) return "🥉";
    return `${pos}º`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h1 className="text-3xl font-bold">Top 10 Correbirras</h1>
        </div>
        <p className="text-gray-600">
          Las carreras favoritas del Levante, votadas por la comunidad.
        </p>
      </div>

      {top.length === 0 ? (
        <div className="card text-center py-12">
          <Medal className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Aún no hay carreras con 3+ valoraciones.</p>
          <p className="text-sm text-gray-400 mt-1">
            ¡Sé el primero en valorar!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map((race, i) => (
            <div key={race._id} className="card flex items-center gap-4">
              <div className="text-3xl w-12 text-center">{getMedal(i + 1)}</div>
              <div className="flex-1 min-w-0">
                <a
                  href={`/carreras/${race.slug}`}
                  className="font-semibold hover:text-runner-primary block truncate"
                >
                  {race.name}
                </a>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                  <span>{race.locality}</span>
                  <span>{race.distanceKm.toFixed(1)} km</span>
                  <span>{race.totalRatings} votos</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-runner-primary">
                  {race.avgGlobal?.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">media</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
