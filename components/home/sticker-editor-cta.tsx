"use client";

/**
 * StickerEditorCta — link "Personalizar el mío" en DiplomaAndSharePreview.
 *
 * Antes era un <Link href="/premium"> fijo (Server Component, sin acceso
 * al estado de suscripción) — un usuario que YA es premium hacía clic y
 * caía en la landing de contratación en vez de ir directo al editor, algo
 * confuso reportado en producción. Este componente decide el destino en
 * cliente según useHasPremium:
 *   - Premium → /mi-sticker (elige una carrera completada y entra al
 *     editor real; no hay un myRaceId concreto en el contexto de la home).
 *   - Sin premium (o cargando) → /premium, igual que antes.
 *
 * Client-only por useHasPremium (Convex) — igual que StickerEditorTeaser
 * y ProTeaser, no se puede resolver en el prerender ISR de la home. En
 * mock mode no hay providers de Clerk/Convex montados, así que no se
 * puede llamar al hook (crashearía) — mismo split isMockMode() que
 * ProTeaser usa para evitar una llamada condicional al hook.
 */

import Link from "next/link";
import { useHasPremium } from "@/components/billing/use-has-premium";
import { isMockMode } from "@/lib/mock/provider";

interface StickerEditorCtaProps {
  className?: string;
  children: React.ReactNode;
}

export function StickerEditorCta(props: StickerEditorCtaProps) {
  const useMock = isMockMode();
  return useMock ? (
    <Link href="/premium" className={props.className}>
      {props.children}
    </Link>
  ) : (
    <RealStickerEditorCta {...props} />
  );
}

function RealStickerEditorCta({ className, children }: StickerEditorCtaProps) {
  const { hasAccess } = useHasPremium();
  return (
    <Link href={hasAccess ? "/mi-sticker" : "/premium"} className={className}>
      {children}
    </Link>
  );
}
