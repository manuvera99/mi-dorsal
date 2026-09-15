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
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { PhotoSearchUploadForm } from "@/components/perfil/photo-search-upload-form";
import { PhotoSearchResults } from "@/components/perfil/photo-search-results";
import {
  detectUnsearchablePhotoProvider,
  unsearchableProviderLabel,
} from "@/lib/photo-source-support";

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

  // Facebook/Google Photos/Drive: descartados como fuente de búsqueda
  // automática (ver docs/optional/photo-sources.md §3.2/§7) — Facebook
  // prohíbe scraping, Google Photos/Drive exigen OAuth del propietario que
  // no tenemos. Si la carrera solo tiene un enlace de esos, se ofrece
  // link-out en vez de precargarlo en un formulario que el backend
  // rechazaría con un 400.
  const unsearchableProvider = context?.defaultAlbumUrl
    ? detectUnsearchablePhotoProvider(context.defaultAlbumUrl)
    : null;

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

          {unsearchableProvider && (
            <UnsearchableAlbumNotice url={context.defaultAlbumUrl!} provider={unsearchableProvider} />
          )}

          {jobIdToShow ? (
            <PhotoSearchResults jobId={jobIdToShow} onSearchAgain={() => setActiveJobId(null)} />
          ) : (
            <PhotoSearchUploadForm
              raceId={raceId as Id<"races">}
              initialDorsal={context.dorsal}
              initialAlbumUrl={unsearchableProvider ? undefined : context.defaultAlbumUrl}
              onJobCreated={(jobId) => setActiveJobId(jobId)}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Aviso cuando el álbum de la carrera es de un proveedor que no podemos
 *  buscar automáticamente (Facebook, Google Photos/Drive) — ver
 *  lib/photo-source-support.ts. Ofrece el enlace directo (link-out) en vez
 *  de un formulario de búsqueda que fallaría en el backend. No bloquea el
 *  formulario de abajo: el usuario puede seguir subiendo selfies con OTRO
 *  álbum (p. ej. si además tiene un enlace de Flickr/ChipLevante a mano). */
function UnsearchableAlbumNotice({
  url,
  provider,
}: {
  url: string;
  provider: ReturnType<typeof detectUnsearchablePhotoProvider>;
}) {
  if (!provider) return null;
  return (
    <div className="card mb-4 flex items-center justify-between gap-3 bg-amber-50 border-amber-200">
      <p className="text-sm text-amber-800">
        Esta carrera tiene un álbum en {unsearchableProviderLabel(provider)} — no podemos
        buscarte automáticamente ahí, pero puedes revisarlo tú mismo.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        Abrir álbum
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
