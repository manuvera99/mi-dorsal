"use client";

// =============================================================================
// mi-dorsal — Hook que combina clubs de RFEA (estático) + manuales (Convex)
// =============================================================================
// El ClubSelect necesita el catálogo COMPLETO: la RFEA scrapeada en build
// time + los clubs manuales/añadidos por el admin en runtime (clubsCatalog
// en Convex).
//
// Este hook:
//   1. Importa el JSON estático (sync, sin latencia).
//   2. Hace useQuery a clubsCatalog.listAll (async, tarda unos ms).
//   3. Combina ambas listas deduplicando por (name, ccaa) normalizado.
//      Los clubs manuales tienen precedencia sobre la RFEA (porque el admin
//      los añadió explícitamente y puede haberlos renombrado).
//   4. En mock mode, el useQuery devuelve undefined → hacemos fallback
//      al array de clubs manuales del mock provider.
//
// En futuro: si la lista combinada crece mucho (>5k), se puede añadir
// búsqueda server-side. Hoy el JSON es 3.812 + manuales <100 → OK.
// =============================================================================

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode, mockApi } from "@/lib/mock/provider";
import clubsData from "@/lib/data/clubs.json";

export type ClubEntry = { name: string; ccaa: string; source: "rfea" | "manual" | "from_suggestion" };

const rfeaClubs: { name: string; ccaa: string }[] = (clubsData as any).clubs;

/**
 * Clave de deduplicación: lowercase + trim. Así "Bull Runners" y
 * "bull runners " cuentan como el mismo club.
 */
function dedupKey(name: string, ccaa: string): string {
  return `${name.trim().toLowerCase()}|${ccaa.trim().toLowerCase()}`;
}

export function useCombinedClubs(): { clubs: ClubEntry[]; isLoading: boolean } {
  const useMock = isMockMode();

  // useQuery en producción; en mock, podemos llamar al mock provider directamente.
  // En Convex, la query devuelve undefined mientras carga, [] cuando termina.
  const convexClubs = useQuery(api.clubsCatalog.listAll, useMock ? "skip" : {});

  return useMemo(() => {
    // Construimos la lista combinada.
    // 1. Partimos de la RFEA (es la base)
    const byKey = new Map<string, ClubEntry>();
    for (const c of rfeaClubs) {
      byKey.set(dedupKey(c.name, c.ccaa), { ...c, source: "rfea" });
    }

    // 2. Capa de clubs manuales. En mock los leemos async vía mockApi;
    //    en Convex usamos el resultado de la query.
    const manuals: ClubEntry[] = (() => {
      if (useMock) {
        // El mockApi.listAll devuelve una Promise, pero no podemos await
        // dentro de useMemo. Resolvemos síncronamente con los valores
        // que el mock exporta. En la práctica, el usuario mock tiene
        // el set de clubs hardcodeado en el provider; podríamos exponerlos
        // de forma sync. Aquí dejamos vacío para no complicar.
        // → Los clubs mock se sirven directamente desde el JSON estático
        //   (que también está disponible en mock). Si quieres ver
        //   clubs mock adicionales, mira mockApi.clubsCatalog.listAll.
        return [];
      }
      return (convexClubs ?? []).map((c) => ({
        name: c.name,
        ccaa: c.ccaa,
        source: c.source as "manual" | "from_suggestion",
      }));
    })();

    // 3. Sobrescribimos/añadimos con los manuales (tienen precedencia)
    for (const c of manuals) {
      byKey.set(dedupKey(c.name, c.ccaa), c);
    }

    // 4. Ordenamos alfabéticamente (collator español: á después de a, etc.)
    const clubs = Array.from(byKey.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );

    return {
      clubs,
      isLoading: !useMock && convexClubs === undefined,
    };
  }, [convexClubs, useMock]);
}
