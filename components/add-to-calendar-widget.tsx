"use client";

// =============================================================================
// mi-dorsal — AddToCalendarWidget
//
// Bloque "¿Vas a correrla?" del sidebar del detalle de carrera.
//
// Reglas de UX:
//  - El dorsal es SIEMPRE opcional. Puedes añadir la carrera al calendario
//    aunque todavía no te hayas inscrito o no te haya llegado el dorsal.
//  - El usuario tiene que estar logueado (real) o simularlo (mock).
//  - Si ya está añadida, muestra estado con check + link al calendario.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import type { Id } from "@/convex/_generated/dataModel";
import { Calendar, Check, ExternalLink, LogIn, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface AddToCalendarWidgetProps {
  raceId: Id<"races">;
  /** Texto del footer ("X corredores la han valorado"). Opcional. */
  footerText?: string;
}

// ---------------------------------------------------------------------------
// MOCK — simula login, persiste en localStorage por usuario
// ---------------------------------------------------------------------------

const MOCK_USER_KEY = "mock-user-signed-in";

function MockAddToCalendar({ raceId, footerText }: AddToCalendarWidgetProps) {
  const [signedIn, setSignedIn] = useState(false);
  const [dorsal, setDorsal] = useState("");
  const [saved, setSaved] = useState(false);
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const STORAGE_ADDED = `mock-myRace-${raceId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSignedIn(localStorage.getItem(MOCK_USER_KEY) === "1");
    setAlreadyAdded(localStorage.getItem(STORAGE_ADDED) === "1");
    setHydrated(true);
  }, [STORAGE_ADDED]);

  const handleAdd = () => {
    // En mock solo necesitamos feedback
    localStorage.setItem(STORAGE_ADDED, "1");
    if (dorsal.trim()) {
      localStorage.setItem(`mock-myRace-${raceId}-dorsal`, dorsal.trim());
    }
    setAlreadyAdded(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignIn = () => {
    localStorage.setItem(MOCK_USER_KEY, "1");
    setSignedIn(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem(MOCK_USER_KEY);
    setSignedIn(false);
  };

  if (!hydrated) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-10 bg-gray-100 rounded w-full" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-runner-primary" />
          ¿Vas a correrla?
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Añádela a tu calendario y te predecimos tu tiempo. El dorsal lo puedes
          añadir después, cuando te llegue.
        </p>
        <button
          onClick={handleSignIn}
          className="btn-primary w-full justify-center"
        >
          <LogIn className="h-4 w-4 mr-1.5" />
          Inicia sesión (demo) para añadirla
        </button>
        {footerText && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <User className="h-3 w-3 inline mr-1" />
            {footerText}
          </div>
        )}
      </div>
    );
  }

  if (alreadyAdded) {
    return (
      <div className="card border-green-200 bg-green-50/50">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-800">
          <Check className="h-4 w-4" />
          Ya está en tu calendario
        </h3>
        {dorsal && (
          <p className="text-sm text-gray-700 mb-2">
            Dorsal: <span className="font-mono font-bold">#{dorsal}</span>
          </p>
        )}
        <Link
          href="/calendario"
          className="btn-secondary w-full justify-center text-sm"
        >
          Ver mi calendario
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Link>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-500 hover:text-red-500 underline mt-2 w-full text-center"
        >
          Logout (demo)
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-runner-primary" />
        ¿Vas a correrla?
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Añádela a tu calendario y te predecimos tu tiempo. El dorsal lo puedes
        añadir después, cuando te llegue.
      </p>
      <div className="space-y-2">
        <label className="label flex items-center justify-between">
          <span>Tu dorsal</span>
          <span className="text-xs text-gray-500 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          className="input"
          placeholder="1234"
          value={dorsal}
          onChange={(e) => setDorsal(e.target.value)}
        />
        <button
          onClick={handleAdd}
          className={cn(
            "btn-primary w-full justify-center",
            saved && "bg-green-600 hover:bg-green-600",
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              ¡Añadida!
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1.5" />
              {dorsal.trim() ? "Añadir con dorsal" : "Añadir a mi calendario"}
            </>
          )}
        </button>
        <p className="text-xs text-gray-500">
          {dorsal.trim()
            ? "Guardaremos el dorsal junto a la carrera."
            : "Sin dorsal: queda como \"planeada\". Añádelo cuando te llegue."}
        </p>
      </div>
      <button
        onClick={handleSignOut}
        className="text-xs text-gray-500 hover:text-red-500 underline mt-3 w-full text-center"
      >
        Logout (demo)
      </button>
      {footerText && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <User className="h-3 w-3 inline mr-1" />
          {footerText}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// REAL — Clerk + Convex
// ---------------------------------------------------------------------------

function RealAddToCalendar({ raceId, footerText }: AddToCalendarWidgetProps) {
  const { isSignedIn, isLoaded } = useUser();
  const toast = useToast();
  const addMutation = useMutation(api.myRaces.add);
  const existing = useQuery(
    api.myRaces.listMine,
    isSignedIn ? {} : ("skip" as any),
  );
  const alreadyAdded = !!existing?.some(
    (m: { raceId: Id<"races"> }) => m.raceId === raceId,
  );

  const [dorsal, setDorsal] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await addMutation({
        raceId,
        dorsalNumber: dorsal.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      // Onboarding: celebramos según el momento.
      //   - isFirstRace:      primera carrera (0 → 1) — el "momento 2" del plan
      //   - justReachedThree: pasa de 2 a 3 — el "momento 5" (hilo con forma)
      //   - default:          carrera N+1 — feedback normal
      if (result.isFirstRace) {
        toast.show({
          variant: "success",
          title: "🏃 Dorsal guardado en tu hilo",
          description: "Te avisamos cuando la organización publique los tiempos.",
          action: { label: "Ver mi calendario", href: "/calendario" },
        });
      } else if (result.justReachedThree) {
        toast.show({
          variant: "success",
          title: "🎉 ¡3 carreras! Tu hilo coge forma",
          description: "Buena temporada. Cuando acabes la primera, te llega el resultado oficial al buzón.",
          action: { label: "Ver hilo", href: "/calendario" },
        });
      } else {
        toast.show({
          variant: "success",
          title: "Carrera añadida",
          description: "La verás en tu calendario.",
          action: { label: "Ver", href: "/calendario" },
        });
      }
    } catch (e: any) {
      const msg = e?.message ?? "Error al añadir la carrera";
      if (msg.includes("ya está en tu calendario")) {
        setError("Esta carrera ya estaba en tu calendario.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || (isSignedIn && existing === undefined)) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-10 bg-gray-100 rounded w-full" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-runner-primary" />
          ¿Vas a correrla?
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Añádela a tu calendario y te predecimos tu tiempo. El dorsal lo puedes
          añadir después, cuando te llegue.
        </p>
        <Link href="/sign-in" className="btn-primary w-full justify-center">
          <LogIn className="h-4 w-4 mr-1.5" />
          Inicia sesión para añadirla
        </Link>
        {footerText && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <User className="h-3 w-3 inline mr-1" />
            {footerText}
          </div>
        )}
      </div>
    );
  }

  if (alreadyAdded) {
    const myRace = existing?.find(
      (m: { raceId: Id<"races">; dorsalNumber?: string }) => m.raceId === raceId,
    );
    return (
      <div className="card border-green-200 bg-green-50/50">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-800">
          <Check className="h-4 w-4" />
          Ya está en tu calendario
        </h3>
        {myRace?.dorsalNumber ? (
          <p className="text-sm text-gray-700 mb-2">
            Dorsal: <span className="font-mono font-bold">#{myRace.dorsalNumber}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-600 mb-2">
            Sin dorsal todavía. Añádelo cuando te llegue desde tu calendario.
          </p>
        )}
        <Link
          href="/calendario"
          className="btn-secondary w-full justify-center text-sm"
        >
          Ver mi calendario
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-runner-primary" />
        ¿Vas a correrla?
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Añádela a tu calendario y te predecimos tu tiempo. El dorsal lo puedes
        añadir después, cuando te llegue.
      </p>
      <div className="space-y-2">
        <label className="label flex items-center justify-between">
          <span>Tu dorsal</span>
          <span className="text-xs text-gray-500 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          className="input"
          placeholder="1234"
          value={dorsal}
          onChange={(e) => setDorsal(e.target.value)}
        />
        <button
          onClick={handleAdd}
          disabled={submitting}
          className={cn(
            "btn-primary w-full justify-center",
            saved && "bg-green-600 hover:bg-green-600",
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              ¡Añadida!
            </>
          ) : submitting ? (
            "Añadiendo…"
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1.5" />
              {dorsal.trim() ? "Añadir con dorsal" : "Añadir a mi calendario"}
            </>
          )}
        </button>
        <p className="text-xs text-gray-500">
          {dorsal.trim()
            ? "Guardaremos el dorsal junto a la carrera."
            : "Sin dorsal: queda como \"planeada\". Añádelo cuando te llegue."}
        </p>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}
      </div>
      {footerText && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <User className="h-3 w-3 inline mr-1" />
          {footerText}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

export function AddToCalendarWidget(props: AddToCalendarWidgetProps) {
  return isMockMode() ? <MockAddToCalendar {...props} /> : <RealAddToCalendar {...props} />;
}
