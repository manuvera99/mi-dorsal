"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { formatTime } from "@/lib/utils";
import { User, Trophy, TrendingUp, Plus, Trash2, RefreshCw } from "lucide-react";

/** Tiempo relativo en español. Usado por el banner de auto-sync. */
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} día${d === 1 ? "" : "s"}`;
}
import { ConnectionsSection } from "@/components/perfil/connections";
import { CoachAnalysisCard } from "@/components/perfil/coach-analysis-card";
import { ActivityStatsCard } from "@/components/perfil/activity-stats";
import { ActivityFeed } from "@/components/perfil/activity-feed";
import { PrFormModal } from "@/components/perfil/pr-form-modal";
import { EditProfileModal, ageFromBirthDate } from "@/components/perfil/edit-profile-modal";
import { PrCardWithMap } from "@/components/perfil/pr-card-with-map";
import { GearCard } from "@/components/perfil/gear-card";
import { useAutoSync } from "@/components/perfil/use-auto-sync";

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
  const upsertProfile = useMutation(api.users.upsertMyProfile);

  // Fix de raíz (8 sep 2026): si Clerk está logueado pero el profile aún
  // no existe en Convex (caso edge del primer login antes de cualquier
  // acción que dispare upsertMyProfile), lo creamos automáticamente con
  // los datos vacíos. Evita que /perfil explote con "Cannot read
  // properties of null" en las queries de actividades que dependen del
  // profile.
  //
  // useEffect + skip cuando ya hay profile. useMutation es seguro de
  // llamar: la mutation es idempotente (si ya existe, hace patch).
  useEffect(() => {
    if (convexProfile === null) {
      // null = no hay profile (NO undefined, que es cargando).
      // Llamamos sin args — Clerk ya inyectó la identity en el JWT, así
      // que la mutation sabe quién es el user aunque no le pasemos nada.
      upsertProfile({}).catch((e) => {
        // Si falla (ej. Clerk no inyectó la identity aún), no bloqueamos
        // la UI: mostramos el error en consola y dejamos que el user
        // vuelva a intentar al interactuar (ej. abrir el form de editar).
        console.error("[RealPerfil] upsertProfile auto falló:", e);
      });
    }
  }, [convexProfile, upsertProfile]);

  return <PerfilContent profile={convexProfile as any} prs={(convexPRs as any) ?? []} />;
}

export default function PerfilPage() {
  const useMock = isMockMode();
  return useMock ? <MockPerfil /> : <RealPerfil />;
}

function PerfilContent({ profile, prs }: { profile: any; prs: any[] }) {
  const [editing, setEditing] = useState(false);
  const age = ageFromBirthDate(profile?.birthDate);

  // Auto-sync con Strava si la última sync tiene más de 6h.
  // Banner discreto arriba del todo mientras corre.
  const { isAutoSyncing, lastSyncedAt, connected } = useAutoSync();

  // Defensivo: si la query devolviera duplicados por la misma distancia
  // (legacy data, inconsistencia), nos quedamos con la mejor marca (menor
  // tiempo) por distancia. El backend ya filtra `isCurrent: true`, pero
  // esto blinda la UI ante cualquier sorpresa.
  const bestPrsByDistance = (() => {
    const byDistance = new Map<number, any>();
    for (const pr of prs) {
      const prev = byDistance.get(pr.distanceM);
      if (!prev || pr.timeSeconds < prev.timeSeconds) {
        byDistance.set(pr.distanceM, pr);
      }
    }
    return Array.from(byDistance.values()).sort(
      (a, b) => a.distanceM - b.distanceM,
    );
  })();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Banner de auto-sync. Solo aparece cuando el hook está activamente
          sincronizando (la última sync es >6h y acabamos de abrir la app).
          No bloquea: el usuario puede seguir interactuando mientras corre. */}
      {isAutoSyncing && connected && (
        <div
          className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-sky-50 border border-sky-200 text-sky-800 text-sm"
          role="status"
          aria-live="polite"
        >
          <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
          <span>
            Sincronizando con Strava para tener tus datos al día…
          </span>
          {lastSyncedAt && (
            <span className="text-xs text-sky-600 ml-auto">
              última sync: hace{" "}
              {timeAgo(lastSyncedAt)}
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-runner-primary text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {(profile?.displayName ?? "M").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate">
                  {profile?.displayName ?? "Cargando…"}
                  {age != null && (
                    <span className="text-base font-normal text-gray-500 ml-2">
                      {age} años
                    </span>
                  )}
                </h1>
                {profile?.club && (
                  <p className="text-sm text-gray-600">📍 {profile.club}</p>
                )}
                {profile?.bio && (
                  <p className="text-sm text-gray-700 mt-2">{profile.bio}</p>
                )}
                {!profile?.bio && !profile?.club && !age && (
                  <p className="text-sm text-gray-500 mt-2 italic">
                    Sin club, bio ni fecha de nacimiento todavía.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-runner-primary hover:underline flex items-center gap-1 flex-shrink-0"
                title="Editar nombre, club, fecha de nacimiento y bio"
              >
                <User className="h-3.5 w-3.5" />
                Editar
              </button>
            </div>
          </div>
        </div>
      </div>

      {editing && profile && (
        <EditProfileModal
          profile={{
            displayName: profile.displayName,
            club: profile.club,
            birthDate: profile.birthDate,
            bio: profile.bio,
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {/* PRs — primero: la acción principal del corredor popular */}
      {isMockMode() ? (
        <PrsSectionReadOnly prs={bestPrsByDistance} />
      ) : (
        <PrsSection prs={bestPrsByDistance} />
      )}

      {/* Stats de actividad — se ocultan si 0 actividades (mostramos empty state en feed) */}
      {!isMockMode() && <ActivityStatsCard />}

      {/* Zapatillas con km totales + alerta de cambio a 800km */}
      {!isMockMode() && <GearCard />}

      {/* Feed de actividades — con empty state para usuarios sin Strava */}
      {!isMockMode() && <ActivityFeed />}

      {/* Análisis narrativo del perfil de corredor — a petición, cacheado en el profile */}
      {!isMockMode() && (
        <CoachAnalysisCard
          coachAnalysisText={profile?.coachAnalysisText}
          coachAnalysisAt={profile?.coachAnalysisAt}
        />
      )}

      {/* Conexiones (Strava export, etc.) — al final, donde están los ajustes */}
      {!isMockMode() && <ConnectionsSection />}
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
            Con una sola marca puedes calcular tu tiempo estimado en el
            resto: media maratón, maratón, lo que te echen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {prs.map((pr) => (
            <PrCardWithMap
              key={pr._id}
              pr={pr}
              onRemove={handleRemovePr}
            />
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
            <PrCardWithMap key={pr._id} pr={pr} />
          ))}
        </div>
      )}
    </div>
  );
}
