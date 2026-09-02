"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { RaceCard } from "@/components/race-card";
import { Trophy, TrendingUp, Calendar, ArrowRight, Sparkles } from "lucide-react";

function MockHomePage() {
  const [races, setRaces] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    mockApi.races.getFeatured({ limit: 6 }).then(setRaces);
    mockApi.ratings.topRaces({ limit: 10 }).then(setTop);
  }, []);

  return <HomeContent races={races} top={top} />;
}

function RealHomePage() {
  const convexRaces = useQuery(api.races.getFeatured, { limit: 6 });
  const convexTop = useQuery(api.ratings.topRaces, { limit: 10 });
  return <HomeContent races={(convexRaces as any) ?? []} top={(convexTop as any) ?? []} />;
}

export default function HomePage() {
  const useMock = isMockMode();
  return useMock ? <MockHomePage /> : <RealHomePage />;
}

function HomeContent({ races, top }: { races: any[]; top: any[] }) {

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* HERO */}
      <section className="rounded-2xl bg-gradient-to-br from-runner-primary to-red-700 px-6 py-12 md:px-12 md:py-16 text-white mb-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Nuevo · v0.1
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Planifica tu temporada de carreras
          </h1>
          <p className="text-lg text-red-50 mb-6">
            Predice tu tiempo en cada carrera, recibe tu resultado oficial y diploma por email automáticamente.
            <br />
            <span className="text-red-100/80 text-base">El hilo que te une a tu dorsal.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/carreras" className="inline-flex items-center gap-2 bg-white text-runner-primary font-semibold px-5 py-2.5 rounded-md hover:bg-red-50 transition-colors">
              Explorar carreras <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/perfil" className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white font-semibold px-5 py-2.5 rounded-md hover:bg-white/20 transition-colors">
              Añadir mis PRs
            </Link>
          </div>
        </div>
      </section>

      {/* TOP 10 */}
      {top.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h2 className="text-2xl font-bold">Top 10 carreras del Levante</h2>
            <span className="badge badge-gray ml-2">votadas por la comunidad</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {top.slice(0, 3).map((race, i) => (
              <div key={race._id} className="relative">
                {i === 0 && <span className="absolute -top-2 -left-2 text-2xl">🥇</span>}
                {i === 1 && <span className="absolute -top-2 -left-2 text-2xl">🥈</span>}
                {i === 2 && <span className="absolute -top-2 -left-2 text-2xl">🥉</span>}
                <RaceCard race={race} />
              </div>
            ))}
          </div>
          {top.length > 3 && (
            <div className="mt-4 text-center">
              <Link href="/ranking" className="text-sm text-runner-primary hover:underline">
                Ver top 10 completo →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* CARRERAS DESTACADAS */}
      {races.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="h-5 w-5 text-runner-primary" />
            <h2 className="text-2xl font-bold">Próximas carreras destacadas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {races.map((race) => (
              <RaceCard key={race._id} race={race} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
        <TrendingUp className="h-8 w-8 text-runner-primary mx-auto mb-3" />
        <h3 className="text-xl font-bold mb-2">¿Cómo funciona?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 text-left">
          <div>
            <div className="text-runner-primary font-bold text-2xl mb-1">1</div>
            <h4 className="font-semibold mb-1">Añade tus PRs</h4>
            <p className="text-sm text-gray-600">Tu marca en 5K, 10K o media maratón. Es lo que usamos para predecir.</p>
          </div>
          <div>
            <div className="text-runner-primary font-bold text-2xl mb-1">2</div>
            <h4 className="font-semibold mb-1">Planifica tu temporada</h4>
            <p className="text-sm text-gray-600">Marca las carreras que vas a correr y mete tu dorsal.</p>
          </div>
          <div>
            <div className="text-runner-primary font-bold text-2xl mb-1">3</div>
            <h4 className="font-semibold mb-1">Recibe tu resultado</h4>
            <p className="text-sm text-gray-600">Te llega por email con diploma PDF al cruzar la meta. Sin volver a la web del organizador.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
