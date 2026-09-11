"use client";

// =============================================================================
// mi-dorsal — /ranking/clubes (cliente)
// =============================================================================
// Tabla de clubs ordenada por nº de socios (C1) / km (C3). Recibe la
// lista inicial del Server Component (fetchQuery en SSR) y la rehidrata
// con useQuery para que se actualice cuando se una alguien nuevo.
// =============================================================================

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { Trophy, Users, ArrowRight } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

type Club = {
  _id: string;
  slug: string;
  name: string;
  ccaa: string;
  memberCount: number;
  seasonDistanceKm: number;
  seasonRacesFinished: number;
};

type Props = {
  initialClubs: Club[];
};

export function ClubsRankingClient({ initialClubs }: Props) {
  const useMock = isMockMode();
  const convexClubs = useQuery(
    api.clubs.getSeasonRankingPlaceholder,
    useMock ? ("skip" as any) : { limit: 100 },
  );

  // En mock mode usamos initialClubs (vendrá vacío del SSR, ya que
  // fetchQuery en server-side con mock devuelve []). En real mode,
  // rehidratamos con la query.
  const clubs: Club[] | undefined = useMock
    ? initialClubs
    : (convexClubs as Club[] | undefined) ?? initialClubs;

  // JSON-LD ItemList (Top 50) — inyectado tras hidratación
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ranking de clubs de atletismo en España",
    description:
      "Clasificación de clubs de la comunidad de corredores populares de mi-dorsal.",
    itemListElement: clubs.slice(0, 50).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/clubs/${c.slug}`,
      name: c.name,
    })),
  };

  return (
    <>
      {clubs.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="h-12 w-12 mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">
            Aún no hay clubs en el ranking. Cuando los primeros socios se
            unan, aparecerán aquí.
          </p>
        </div>
      ) : (
        <ol className="space-y-2" data-testid="ranking-list">
          {clubs.map((club, i) => (
            <li key={club._id}>
              <ClubRow club={club} position={i + 1} />
            </li>
          ))}
        </ol>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
    </>
  );
}

function getMedal(pos: number) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `${pos}º`;
}

function ClubRow({ club, position }: { club: Club; position: number }) {
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="card flex items-center gap-4 hover:border-runner-primary/40 transition-colors group"
    >
      <div className="w-10 text-center text-xl flex-shrink-0">
        {getMedal(position)}
      </div>
      <div
        className="h-10 w-10 rounded-full bg-gradient-to-br from-runner-primary to-rose-700 flex items-center justify-center text-white font-bold flex-shrink-0"
        aria-hidden="true"
      >
        {club.name.trim().charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate group-hover:text-runner-primary">
          {club.name}
        </p>
        <p className="text-xs text-stone-500">{club.ccaa}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1.5 justify-end">
          <Users className="h-3.5 w-3.5 text-stone-400" />
          <span className="font-mono text-sm font-semibold text-stone-900">
            {club.memberCount}
          </span>
          <span className="text-xs text-stone-500">socios</span>
        </div>
        {club.seasonDistanceKm > 0 && (
          <p className="text-[10px] text-stone-500 mt-0.5 font-mono">
            {club.seasonDistanceKm.toLocaleString("es-ES")} km
          </p>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-runner-primary flex-shrink-0" />
    </Link>
  );
}
