"use client";

/**
 * PhotoSearchDetailClient — pantalla de una carrera dentro de "Encuentra
 * tus fotos": si ya hay una búsqueda para el usuario, muestra su
 * resultado (o progreso); si no, muestra el formulario de subida.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, ImageOff, Loader2 } from "lucide-react";
import { PhotoSearchUploadForm } from "@/components/perfil/photo-search-upload-form";
import { PhotoSearchResults } from "@/components/perfil/photo-search-results";

export function PhotoSearchDetailClient({ raceId }: { raceId: string }) {
  const router = useRouter();
  const premiumStatus = useQuery(api.subscriptions.getMyPremiumStatus, {});
  const isLoaded = premiumStatus !== undefined;
  const hasAccess = premiumStatus?.hasAccess ?? false;

  const context = useQuery(
    api.photoSearch.getRaceContext,
    hasAccess ? { raceId: raceId as Id<"races"> } : "skip",
  );

  // Job "activo" en la sesión: el que se acaba de crear (onJobCreated), o
  // el último real de la carrera (mientras el usuario no pida buscar de
  // nuevo). null = mostrar el formulario de subida.
  const [activeJobId, setActiveJobId] = useState<Id<"photoSearchJobs"> | null | undefined>(
    undefined,
  );

  const jobIdToShow = activeJobId !== undefined ? activeJobId : context?.lastJobId ?? null;

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
        href="/perfil/fotos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-runner-primary mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a tus carreras
      </Link>

      {context === undefined && (
        <div className="card animate-pulse h-24" />
      )}

      {context === null && (
        <div className="card text-center py-10 text-gray-500">
          No encontramos esta carrera en tu calendario.
        </div>
      )}

      {context && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{context.race.name}</h1>
            <p className="text-sm text-gray-500">{formatDate(context.race.startDate)}</p>
          </div>

          {!context.supported ? (
            <div className="card text-center py-10">
              <ImageOff className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="font-medium">
                Esta carrera usa un proveedor de fotos que aún no soportamos automáticamente
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Solo álbumes de Flickr por ahora. Iremos añadiendo más proveedores.
              </p>
            </div>
          ) : jobIdToShow ? (
            <PhotoSearchResults jobId={jobIdToShow} onSearchAgain={() => setActiveJobId(null)} />
          ) : (
            <PhotoSearchUploadForm
              raceId={raceId as Id<"races">}
              initialDorsal={context.dorsal}
              onJobCreated={(jobId) => setActiveJobId(jobId)}
            />
          )}
        </>
      )}
    </div>
  );
}
