"use client";

// =============================================================================
// mi-dorsal — /calendario
//
// El calendario personal se presenta como un "hilo" (timeline vertical) que
// conecta las carreras del usuario en orden cronológico. La metáfora visual
// está alineada con el tagline de marca: "El hilo que te une a tu dorsal".
//
// Vista por defecto: solo próximas (planeadas con fecha >= hoy, ASC).
// Toggle "Todas" para ver también el pasado con un marcador "Hoy" entre
// pasado y futuro.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { cn } from "@/lib/utils";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { HiloTimeline } from "@/components/calendario/hilo-timeline";

type View = "proximas" | "todas";

function MockCalendario() {
  const [myRaces, setMyRaces] = useState<any[]>([]);
  useEffect(() => {
    mockApi.myRaces.listMine().then((r) => setMyRaces(r as any));
  }, []);
  return <CalendarioContent myRaces={myRaces} />;
}

function RealCalendario() {
  const convexMyRaces = useQuery(api.myRaces.listMine, {});
  return <CalendarioContent myRaces={(convexMyRaces as any) ?? []} />;
}

export default function CalendarioPage() {
  const useMock = isMockMode();
  return useMock ? <MockCalendario /> : <RealCalendario />;
}

function CalendarioContent({ myRaces }: { myRaces: any[] }) {
  const [view, setView] = useState<View>("proximas");

  // Orden cronológico ASC. Las carreras sin startDate se van al final.
  const sorted = useMemo(() => {
    return [...myRaces].sort((a, b) => {
      const da = a.race?.startDate
        ? new Date(a.race.startDate).getTime()
        : Number.POSITIVE_INFINITY;
      const db = b.race?.startDate
        ? new Date(b.race.startDate).getTime()
        : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [myRaces]);

  const todayMs = Date.now();

  // Carreras pasadas: cualquier status con startDate < hoy.
  const pastCount = useMemo(
    () =>
      sorted.filter(
        (mr) =>
          mr.race?.startDate &&
          new Date(mr.race.startDate).getTime() < todayMs,
      ).length,
    [sorted, todayMs],
  );

  // Carreras futuras planeadas (>= hoy).
  const upcoming = useMemo(
    () =>
      sorted.filter(
        (mr) =>
          mr.status === "planned" &&
          mr.race?.startDate &&
          new Date(mr.race.startDate).getTime() >= todayMs,
      ),
    [sorted, todayMs],
  );

  const visibleRaces = view === "proximas" ? upcoming : sorted;
  const showTodayMarker = view === "todas" && pastCount > 0;

  // ----- Empty states ---------------------------------------------------------
  if (myRaces.length === 0) {
    return <EmptyStateZero />;
  }

  if (view === "proximas" && upcoming.length === 0) {
    return (
      <EmptyStateAllPast
        pastCount={pastCount}
        onShowAll={() => setView("todas")}
      />
    );
  }

  // ----- Main render ----------------------------------------------------------
  const headlineCount =
    view === "proximas" ? upcoming.length : myRaces.length;
  const headlineLabel =
    view === "proximas"
      ? "carreras en tu hilo por venir"
      : "carreras en tu hilo";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
        <div>
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-runner-primary">
            Mi calendario
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Tu hilo
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {headlineCount} {headlineLabel}
            {pastCount > 0 && view === "todas" && (
              <>
                {" "}
                ·{" "}
                <span className="text-stone-500">
                  {pastCount} {pastCount === 1 ? "ya en tu historial" : "en tu historial"}
                </span>
              </>
            )}
            .
          </p>
        </div>

        <Link
          href="/carreras"
          className="btn-primary inline-flex w-fit whitespace-nowrap"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Añadir carrera
        </Link>
      </div>

      {/* Toggle Próximas / Todas */}
      <div
        className="mb-8 inline-flex rounded-full border border-stone-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Filtrar por horizonte temporal"
      >
        <ToggleButton
          active={view === "proximas"}
          onClick={() => setView("proximas")}
          label="Próximas"
          count={upcoming.length}
        />
        <ToggleButton
          active={view === "todas"}
          onClick={() => setView("todas")}
          label="Todas"
          count={myRaces.length}
        />
      </div>

      {/* El hilo */}
      <HiloTimeline
        myRaces={visibleRaces}
        showTodayMarker={showTodayMarker}
      />

      {/* Pie — CTA suave para añadir más carreras al hilo */}
      {view === "proximas" && upcoming.length > 0 && (
        <div className="mx-auto mt-10 max-w-md text-center">
          <div className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-stone-400">
            <Sparkles className="h-3 w-3" />
            Sigue tejiendo
          </div>
          <p className="mb-4 text-sm text-stone-600">
            Cada carrera nueva se anuda al hilo. Cuantas más, más cuenta la
            historia.
          </p>
          <Link
            href="/carreras"
            className="btn-secondary inline-flex"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Buscar más carreras
          </Link>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponentes
// -----------------------------------------------------------------------------

function ToggleButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "bg-runner-primary text-white shadow-sm"
          : "text-stone-600 hover:text-stone-900",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold",
          active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyStateZero() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
        <div>
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-runner-primary">
            Mi calendario
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Tu hilo
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            El hilo que te une a tu dorsal empieza aquí.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        {/* Dorsal mini decorativo (consistente con el welcome overlay) */}
        <div
          aria-hidden="true"
          className="mb-5 inline-flex items-center justify-center rounded-2xl bg-runner-primary px-5 py-3 text-white shadow-lg shadow-red-500/20"
        >
          <span className="font-mono text-3xl font-bold tracking-tighter">
            001
          </span>
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-stone-900">
          Tu hilo empieza con el primer dorsal
        </h2>
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-stone-600">
          Apúntate a la primera carrera y empezaremos a tejerlo. Aquí irán
          apareciendo con su fecha, su dorsal y, cuando llegue el día, tu
          tiempo oficial directo del buzón.
        </p>
        <Link href="/carreras" className="btn-primary inline-flex">
          Ver carreras cerca de mí
        </Link>
        <p className="mx-auto mt-6 max-w-sm text-xs text-stone-400">
          No guardamos nada hasta que tú le des. Sin compromiso, sin spam, sin
          notificaciones raras.
        </p>
      </div>
    </div>
  );
}

function EmptyStateAllPast({
  pastCount,
  onShowAll,
}: {
  pastCount: number;
  onShowAll: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
        <div>
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-runner-primary">
            Mi calendario
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Tu hilo
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            0 carreras próximas · {pastCount} en tu historial.
          </p>
        </div>

        <Link
          href="/carreras"
          className="btn-primary inline-flex w-fit whitespace-nowrap"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Añadir carrera
        </Link>
      </div>

      <div className="mx-auto max-w-xl rounded-2xl border-2 border-dashed border-stone-300 bg-white p-8 text-center">
        <div className="mb-3 font-mono text-5xl font-bold text-stone-300">
          ···
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-stone-900">
          Tu hilo está esperando
        </h2>
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-stone-600">
          Has corrido {pastCount} {pastCount === 1 ? "carrera" : "carreras"}.
          ¿Cuál será la siguiente? Anuda la próxima y vuelve a tejer el
          hilo.
        </p>
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/carreras" className="btn-primary inline-flex">
            <Plus className="mr-1.5 h-4 w-4" /> Buscar mi próxima
          </Link>
          <button
            type="button"
            onClick={onShowAll}
            className="btn-ghost inline-flex"
          >
            Ver todas (incluye pasadas)
          </button>
        </div>
      </div>
    </div>
  );
}
