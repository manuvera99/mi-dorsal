"use client";

// =============================================================================
// mi-dorsal — /clubs/[slug] (cliente)
// =============================================================================
// Bloque interactivo: botón "Únete al club" / "Salir del club" detrás de
// <PremiumFeatureLock>. El resto de la ficha es Server Component.
//
// Patrón de paywall (sesión 8 sep 2026): el botón está visible para
// todos, pero si el usuario no es Pro se reemplaza por un upsell que
// lleva a /premium. NO redirigimos automáticamente — el corredor popular
// necesita entender el valor antes de pagar.
// =============================================================================

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PremiumFeatureLock } from "@/components/billing/premium-feature-lock";
import { useHasPremium } from "@/components/billing/use-has-premium";
import { Sparkles, LogOut, Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

type Props = {
  clubSlug: string;
  clubName: string;
};

export function ClubDetailClient({ clubSlug, clubName }: Props) {
  // Necesitamos el _id del club para llamar a joinClub. Hacemos una
  // query ligera a getCatalogForList (ya cacheada) y buscamos por slug.
  // Si en producción el catálogo crece, considerar añadir getBySlugId.
  const catalog = useQuery(api.clubs.getCatalogForList, { limit: 1000 });
  const club = catalog?.find((c) => c.slug === clubSlug);

  const myMembership = useQuery(api.clubs.getMyMembership);
  const joinClub = useMutation(api.clubs.joinClub);
  const leaveClub = useMutation(api.clubs.leaveClub);
  const router = useRouter();
  const { hasAccess } = useHasPremium();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const isMyClub =
    myMembership?.club.slug === clubSlug && myMembership != null;

  const handleJoin = async () => {
    if (!club) return;
    setSubmitting(true);
    try {
      await joinClub({ clubCatalogId: club._id as Id<"clubsCatalog"> });
      toast.show({
        title: `¡Bienvenido a ${clubName}!`,
        description:
          "Ya sumas con tu club. Cada dorsal finalizado se añadirá a la temporada.",
        variant: "success",
      });
      router.refresh();
    } catch (e: any) {
      toast.show({
        title: "No se pudo unir al club",
        description: e?.message ?? "Inténtalo de nuevo en unos segundos.",
        variant: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm(`¿Seguro que quieres salir de ${clubName}?`)) return;
    setSubmitting(true);
    try {
      await leaveClub();
      toast.show({
        title: `Has salido de ${clubName}`,
        description: "Puedes unirte a otro club cuando quieras.",
        variant: "info",
      });
      router.refresh();
    } catch (e: any) {
      toast.show({
        title: "No se pudo salir del club",
        description: e?.message ?? "Inténtalo de nuevo en unos segundos.",
        variant: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (myMembership === undefined) {
    return (
      <div className="card animate-pulse h-20" aria-label="Cargando" />
    );
  }

  // Ya es socio de otro club → mensaje explicativo
  if (myMembership && !isMyClub) {
    return (
      <div className="card text-sm text-stone-700">
        <p>
          Ya perteneces a{" "}
          <strong>{myMembership.club.name}</strong>. Para sumarte a{" "}
          <strong>{clubName}</strong> primero tienes que salir del actual.
        </p>
      </div>
    );
  }

  // Ya es socio de este club → botón "Salir"
  if (isMyClub) {
    return (
      <div className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-stone-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-runner-primary" />
              Eres socio de {clubName}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              Te uniste el{" "}
              {new Date(myMembership!.joinedAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {myMembership!.dorsalNumber && (
                <> · Dorsal {myMembership!.dorsalNumber}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLeave}
            disabled={submitting}
            className="btn-secondary inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Salir del club
          </button>
        </div>
      </div>
    );
  }

  // No es socio → CTA "Únete al club" (gated por Pro)
  if (!club) {
    return (
      <div className="card text-sm text-stone-500">
        No se ha podido cargar la información del club.
      </div>
    );
  }

  if (hasAccess) {
    // Pro: botón directo
    return (
      <div className="card">
        <button
          type="button"
          onClick={handleJoin}
          disabled={submitting}
          className="btn-primary inline-flex items-center gap-2 w-full sm:w-auto"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Únete al club
        </button>
        <p className="text-xs text-stone-500 mt-2">
          Sumarás cada dorsal finalizado a la temporada de {clubName}.
        </p>
      </div>
    );
  }

  // Free: PremiumFeatureLock con el copy específico de clubs
  return (
    <PremiumFeatureLock
      feature={`Unirse a ${clubName}`}
      description="Únete a tu club, sumad dorsales y apareced en el ranking de la temporada. Disponible para socios Dorsal Pro."
      variant="banner"
    >
      <></>
    </PremiumFeatureLock>
  );
}
