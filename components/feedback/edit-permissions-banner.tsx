"use client";

// =============================================================================
// mi-dorsal — EditPermissionsBanner
// =============================================================================
// Banner sutil que se muestra en la ficha de una carrera cuando el usuario NO
// es admin. Disuelve la expectativa de poder editar datos directamente: solo
// puede valorar (👍/👎, 8D) y reportar errores con el botón rojo.
//
// Mantener la regla en sync con `canEditRace` en convex/_helpers.ts.
// Aquí duplicamos el check para evitar importar el módulo server-only.
// =============================================================================

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Info, Sparkles, Bug } from "lucide-react";

export function EditPermissionsBanner() {
  const { isSignedIn, isLoaded } = useUser();
  const myProfile = useQuery(api.users.getMyProfile, isSignedIn ? {} : "skip");
  const isAdmin = myProfile?.role === "admin";

  // No mostrar hasta que sepamos quién es, ni para admins.
  if (!isLoaded) return null;
  if (isAdmin) return null;

  return (
    <div className="mt-2 mb-1 p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-xs text-blue-900 flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <p className="leading-relaxed">
          En esta ficha puedes <strong>valorar</strong> (👍/👎 y la puntuación 8D) y
          <strong> reportar un error</strong> si ves algo mal. Para proponer cambios
          en los datos, pulsa el botón rojo de abajo — los revisamos y los aplicamos
          si toca.
        </p>
        <p className="text-blue-700/80 mt-1 text-[11px] flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Crear una carrera nueva → busca en{" "}
            <a href="/carreras" className="underline font-semibold">el catálogo</a>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Bug className="h-3 w-3" />
            Reportar error → botón abajo
          </span>
        </p>
      </div>
    </div>
  );
}
