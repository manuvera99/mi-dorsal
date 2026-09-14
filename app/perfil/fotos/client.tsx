"use client";

/**
 * PhotoSearchListClient — "Encuentra tus fotos": listado de carreras del
 * calendario del usuario que tienen álbum de fotos soportado (Flickr).
 *
 * Usa convex/photoSearch.ts::listRacesWithPhotos (join myRaces + races +
 * último job, si existe). Cada carrera lleva a /perfil/fotos/[raceId],
 * donde se sube la selfie o se ve el resultado de una búsqueda anterior.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/utils";
import { Camera, ArrowLeft, ImageOff, ChevronRight, Search, CheckCircle2, Loader2 } from "lucide-react";

export function PhotoSearchListClient() {
  const router = useRouter();
  const premiumStatus = useQuery(api.subscriptions.getMyPremiumStatus, {});
  const isLoaded = premiumStatus !== undefined;
  const hasAccess = premiumStatus?.hasAccess ?? false;

  const races = useQuery(api.photoSearch.listRacesWithPhotos, hasAccess ? {} : "skip");

  useEffect(() => {
    if (isLoaded && !hasAccess) {
      router.push("/premium");
    }
  }, [isLoaded, hasAccess, router]);

  if (!isLoaded || !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/perfil"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-runner-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a tu perfil
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-full bg-runner-primary/10 text-runner-primary flex items-center justify-center flex-shrink-0">
          <Camera className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Encuentra tus fotos</h1>
          <p className="text-sm text-gray-600">
            Sube una selfie y te decimos en qué fotos del álbum apareces.
          </p>
        </div>
      </div>

      {races === undefined && (
        <div className="card animate-pulse">
          <div className="h-5 w-2/3 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-1/3 bg-gray-100 rounded" />
        </div>
      )}

      {races !== undefined && races.length === 0 && (
        <div className="card text-center py-10">
          <ImageOff className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">
            Ninguna de tus carreras tiene álbum de fotos todavía
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Cuando el organizador publique las fotos y las enlacemos, aparecerán aquí.
          </p>
        </div>
      )}

      {races !== undefined && races.length > 0 && (
        <div className="flex flex-col gap-3">
          {races.map(({ race, dorsal, lastJob }) => (
            <Link
              key={race!._id}
              href={`/perfil/fotos/${race!._id}`}
              className="card flex items-center justify-between gap-4 hover:border-runner-primary/40"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{race!.name}</p>
                <p className="text-sm text-gray-500">
                  {formatDate(race!.startDate)}
                  {dorsal && <> · Dorsal {dorsal}</>}
                </p>
                {lastJob && (
                  <StatusBadge status={lastJob.status} resultCount={lastJob.resultCount} />
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  resultCount,
}: {
  status: "pending" | "running" | "done" | "error" | "cancelled";
  resultCount: number;
}) {
  if (status === "done" && resultCount > 0) {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-runner-accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {resultCount} foto{resultCount === 1 ? "" : "s"} encontrada{resultCount === 1 ? "" : "s"}
      </p>
    );
  }
  if (status === "done") {
    return <p className="mt-1 text-xs text-gray-500">Sin resultados en la última búsqueda</p>;
  }
  if (status === "running" || status === "pending") {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <Search className="h-3.5 w-3.5" />
        Buscando…
      </p>
    );
  }
  if (status === "error") {
    return <p className="mt-1 text-xs text-red-600">La última búsqueda falló, prueba de nuevo</p>;
  }
  return null;
}
