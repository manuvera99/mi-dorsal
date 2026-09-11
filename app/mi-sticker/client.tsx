"use client";

// =============================================================================
// mi-dorsal — /mi-sticker
// =============================================================================
// Segundo punto de entrada al editor de sticker (el primero es el botón
// "Personalizar sticker" en /resultado/{myRaceId} — ver Task 13). Aquí el
// usuario elige de su historial qué carrera personalizar. Mismo gate
// premium client-side que /editor-sticker/{myRaceId}.
// =============================================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { formatTime, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

export function MiStickerClient() {
  const useMock = isMockMode();
  const router = useRouter();

  const premiumStatus = useMock ? undefined : useQuery(api.subscriptions.getMyPremiumStatus, {});
  const isLoaded = useMock || premiumStatus !== undefined;
  const hasAccess = premiumStatus?.hasAccess ?? false;

  const myRaces = useMock ? null : useQuery(api.myRaces.listMine, { status: "done" });
  const completedRaces = (myRaces ?? []).filter((r) => r.actualTimeSeconds != null);

  useEffect(() => {
    if (useMock) return;
    if (isLoaded && !hasAccess) {
      router.push("/premium");
    }
  }, [useMock, isLoaded, hasAccess, router]);

  const canRender = useMock || (isLoaded && hasAccess);
  if (!canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-runner-primary mb-4">
        <ArrowLeft className="h-4 w-4" />
        Inicio
      </Link>

      <h1 className="text-2xl font-bold text-runner-dark mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-runner-primary" />
        Personaliza tu sticker
      </h1>
      <p className="text-sm text-stone-600 mb-6">
        Elige una carrera para editar su sticker de Stories.
      </p>

      {myRaces === undefined ? (
        <div className="space-y-2">
          <div className="h-16 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-stone-100 rounded-lg animate-pulse" />
        </div>
      ) : completedRaces.length === 0 ? (
        <div className="card text-center text-sm text-stone-500">
          Todavía no tienes carreras completadas con resultado.
        </div>
      ) : (
        <div className="space-y-2">
          {completedRaces.map((myRace) => (
            <Link
              key={myRace._id}
              href={`/editor-sticker/${myRace._id}`}
              className="card flex items-center justify-between hover:border-runner-primary transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-stone-800">{myRace.race?.name ?? "Carrera"}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {myRace.race?.startDate ? formatDate(myRace.race.startDate) : ""}
                  {myRace.actualTimeSeconds != null ? ` · ${formatTime(myRace.actualTimeSeconds)}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
