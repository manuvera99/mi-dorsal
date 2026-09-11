"use client";

// =============================================================================
// mi-dorsal — /clubs (cliente)
// =============================================================================
// Catálogo interactivo. Lista clubs desde Convex con:
//   - Filtro por CCAA (chips de CCAA con conteo).
//   - Card por club con escudo placeholder, nombre, CCAA, nº de socios y
//     "Únete al club" → /clubs/[slug].
//   - Empty state honesto si aún no hay clubs (mejor que inflar números).
//
// Inyecta ItemList JSON-LD con los slugs de los clubs visibles para que
// Google los indexe (mismo patrón que /carreras). El JSON-LD se
// pre-serializa aquí en el cliente, no en build time, porque los datos
// cambian con el filtro. AGENTS §2.2 lo permite para listas filtradas.
// =============================================================================

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { Trophy, Users, ArrowRight } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

const CCAA_OPTIONS = [
  "Todas",
  "Andalucía",
  "Aragón",
  "Asturias",
  "Islas Baleares",
  "Canarias",
  "Cantabria",
  "Castilla y León",
  "Castilla-La Mancha",
  "Cataluña",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "País Vasco",
] as const;

type Club = {
  _id: string;
  slug: string;
  name: string;
  ccaa: string;
  source: "manual" | "from_suggestion";
  memberCount: number;
  seasonDistanceKm: number;
  seasonRacesFinished: number;
};

export function ClubsCatalogClient() {
  const useMock = isMockMode();
  const [ccaa, setCcaa] = useState<(typeof CCAA_OPTIONS)[number]>("Todas");

  // En mock mode devolvemos [] directamente (mockApi no incluye clubs todavía;
  // cuando se añada, se cablea aquí). En real mode, Convex query.
  const convexClubs = useQuery(
    api.clubs.getCatalogForList,
    useMock ? ("skip" as any) : { limit: 200, ccaa: ccaa === "Todas" ? undefined : ccaa },
  );

  const clubs: Club[] | undefined = useMock ? [] : (convexClubs as Club[] | undefined);

  // ItemList JSON-LD para SEO (pre-serializado aquí, AGENTS §2.2)
  const itemList = useMemo(() => {
    if (!clubs || clubs.length === 0) return null;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: clubs.slice(0, 50).map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}/clubs/${c.slug}`,
        name: c.name,
      })),
    };
  }, [clubs]);

  return (
    <>
      {/* Filtro CCAA */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CCAA_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCcaa(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              ccaa === c
                ? "bg-runner-primary text-white border-runner-primary"
                : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Lista */}
      {clubs === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-stone-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-stone-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : clubs.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3" data-testid="clubs-list">
          {clubs.map((club) => (
            <li key={club._id}>
              <ClubCard club={club} />
            </li>
          ))}
        </ul>
      )}

      {/* JSON-LD ItemList inyectado tras el primer fetch */}
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      )}
    </>
  );
}

function ClubCard({ club }: { club: Club }) {
  const medalIcon =
    club.seasonDistanceKm >= 1000
      ? <Trophy className="h-4 w-4 text-yellow-600" />
      : club.memberCount >= 5
      ? <Users className="h-4 w-4 text-stone-500" />
      : null;

  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="card flex items-center gap-4 hover:border-runner-primary/40 transition-colors group"
    >
      <ClubShield name={club.name} ccaa={club.ccaa} />
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-stone-900 truncate group-hover:text-runner-primary">
          {club.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1">
          <span>{club.ccaa}</span>
          {club.source === "from_suggestion" && (
            <span className="text-[10px] uppercase tracking-wide text-runner-primary font-semibold">
              · añadido
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1.5 justify-end">
          {medalIcon}
          <span className="font-mono text-sm font-semibold text-stone-900">
            {club.memberCount}
          </span>
          <span className="text-xs text-stone-500">socios</span>
        </div>
        {club.seasonDistanceKm > 0 && (
          <div className="text-[10px] text-stone-500 mt-0.5">
            {club.seasonDistanceKm.toLocaleString("es-ES")} km esta temporada
          </div>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-runner-primary flex-shrink-0" />
    </Link>
  );
}

/** Escudo placeholder (C1). Cuando aterrice upload de escudos en C3 lo
 *  cambiamos por la URL real del club.shieldUrl. */
function ClubShield({ name, ccaa: _ccaa }: { name: string; ccaa: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="h-12 w-12 rounded-full bg-gradient-to-br from-runner-primary to-rose-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card text-center py-12">
      <Users className="h-12 w-12 mx-auto text-stone-300 mb-3" />
      <p className="text-stone-500">
        Aún no hay clubs en el catálogo de tu comunidad.
      </p>
      <p className="text-sm text-stone-400 mt-1">
        Estamos añadiendo los principales. ¿No encuentras el tuyo? Avísanos
        desde tu <a href="/perfil" className="text-runner-primary hover:underline">perfil</a>.
      </p>
    </div>
  );
}
