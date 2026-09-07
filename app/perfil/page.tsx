"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { formatTime } from "@/lib/utils";
import { User, Trophy, TrendingUp, Plus, Trash2 } from "lucide-react";
import { ConnectionsSection } from "@/components/perfil/connections";
import { PredictionsCard } from "@/components/perfil/predictions-card";
import { RunnerTypeCard } from "@/components/perfil/runner-type-card";
import { ActivityStatsCard } from "@/components/perfil/activity-stats";
import { ActivityFeed } from "@/components/perfil/activity-feed";
import { PrFormModal } from "@/components/perfil/pr-form-modal";

function MockPerfil() {
  const [profile, setProfile] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);
  useEffect(() => {
    mockApi.users.getMyProfile().then((p) => setProfile(p));
    mockApi.personalRecords.listMine().then((p) => setPrs(p as any));
  }, []);
  return <PerfilContent profile={profile} prs={prs} />;
}

function RealPerfil() {
  const convexProfile = useQuery(api.users.getMyProfile, {});
  const convexPRs = useQuery(api.personalRecords.listMine, {});
  return <PerfilContent profile={convexProfile as any} prs={(convexPRs as any) ?? []} />;
}

export default function PerfilPage() {
  const useMock = isMockMode();
  return useMock ? <MockPerfil /> : <RealPerfil />;
}

function PerfilContent({ profile, prs }: { profile: any; prs: any[] }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-runner-primary text-white flex items-center justify-center text-2xl font-bold">
            {(profile?.displayName ?? "M").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{profile?.displayName ?? "Cargando…"}</h1>
            {profile?.club && (
              <p className="text-sm text-gray-600">📍 {profile.club}</p>
            )}
            {profile?.bio && (
              <p className="text-sm text-gray-700 mt-2">{profile.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Conexiones (Strava export, etc.) — solo en modo real */}
      {!isMockMode() && <ConnectionsSection />}

      {/* Tu hilo runner (heurísticas) — solo en modo real */}
      {!isMockMode() && <RunnerTypeCard />}

      {/* Stats de actividad */}
      {!isMockMode() && <ActivityStatsCard />}

      {/* Feed de actividades */}
      {!isMockMode() && <ActivityFeed />}

      {/* Predicciones VDOT inline — solo si hay al menos 1 PR.
          Es la "celebración" del momento 3 del onboarding: cuando el
          usuario tiene su primer PR, esta card aparece con VDOT y
          predicciones para 5K/10K/Media/Maratón. */}
      {prs.length > 0 && (
        <div className="mb-6">
          <PredictionsCard
            prs={prs.map((pr) => ({
              distanceM: pr.distanceM,
              distanceLabel: pr.distanceLabel,
              timeSeconds: pr.timeSeconds,
            }))}
          />
        </div>
      )}

      {/* PRs */}
      {isMockMode() ? <PrsSectionReadOnly prs={prs} /> : <PrsSection prs={prs} />}

      {/* Stats summary */}
      <div className="card">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-runner-primary" /> Mi temporada 2026
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-3xl font-bold text-runner-primary">3</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Carreras</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-runner-primary">57.2</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">km oficiales</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-runner-accent">3:00:00</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Tiempo total</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-yellow-500">5</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Valoraciones hechas</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección de PRs (modo real): con formulario para añadir y botón de borrar.
// Se separa de PerfilContent porque usa useMutation, que exige un
// ConvexProvider en el árbol — en modo mock no hay ninguno montado.
// ---------------------------------------------------------------------------

function PrsSection({ prs }: { prs: any[] }) {
  const [showPrForm, setShowPrForm] = useState(false);
  const removePr = useMutation(api.personalRecords.remove);

  const handleRemovePr = async (id: string, distanceLabel: string) => {
    if (!confirm(`¿Eliminar tu marca de ${distanceLabel}? Esta acción no se puede deshacer.`)) {
      return;
    }
    await removePr({ id: id as any });
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" /> Mis marcas personales
        </h2>
        <button className="btn-secondary text-sm" onClick={() => setShowPrForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
        </button>
      </div>
      {prs.length === 0 ? (
        <div className="py-6 px-2 text-center">
          {/* Dorsal mini decorativo */}
          <div
            aria-hidden="true"
            className="inline-flex items-center justify-center mb-3 rounded-xl bg-runner-warm border border-stone-200 px-4 py-3"
          >
            <span className="font-mono text-2xl font-bold text-stone-300 tracking-tighter">--:--</span>
          </div>
          <h3 className="font-semibold text-stone-900 mb-1">
            Tu primer PR abre el hilo
          </h3>
          <p className="text-sm text-stone-600 max-w-sm mx-auto mb-4 leading-relaxed">
            Añade tu mejor marca en una distancia (5K, 10K, lo que sea).
            Con una sola marca te predecimos el resto: media maratón,
            maratón, lo que te echen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {prs.map((pr) => (
            <div key={pr._id} className="relative border border-gray-200 rounded-md p-3 group">
              <button
                onClick={() => handleRemovePr(pr._id, pr.distanceLabel)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Eliminar marca de ${pr.distanceLabel}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {pr.distanceLabel}
              </div>
              <div className="text-2xl font-bold text-runner-primary font-mono">
                {formatTime(pr.timeSeconds)}
              </div>
              {pr.achievedAt && (
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(pr.achievedAt).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPrForm && <PrFormModal onClose={() => setShowPrForm(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección de PRs (modo mock): solo lectura, sin mutations ni formulario.
// ---------------------------------------------------------------------------

function PrsSectionReadOnly({ prs }: { prs: any[] }) {
  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" /> Mis marcas personales
        </h2>
      </div>
      {prs.length === 0 ? (
        <div className="py-6 px-2 text-center text-sm text-stone-600">
          Sin marcas todavía.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {prs.map((pr) => (
            <div key={pr._id} className="border border-gray-200 rounded-md p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {pr.distanceLabel}
              </div>
              <div className="text-2xl font-bold text-runner-primary font-mono">
                {formatTime(pr.timeSeconds)}
              </div>
              {pr.achievedAt && (
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(pr.achievedAt).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
