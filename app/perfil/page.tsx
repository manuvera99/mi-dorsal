"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { formatTime } from "@/lib/utils";
import { User, Trophy, TrendingUp, Plus } from "lucide-react";

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

      {/* PRs */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" /> Mis marcas personales
          </h2>
          <button className="btn-secondary text-sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
          </button>
        </div>
        {prs.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No has añadido ningún PR. Añade al menos uno para predecir tus tiempos.
          </p>
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
