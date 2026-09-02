"use client";

import { useQuery, useMutation } from "convex/react";
import { api, Id } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { isMockMode } from "@/lib/mock/provider";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Shield, ShieldOff, Loader2, Trophy, Calendar, ThumbsUp, Star, User as UserIcon } from "lucide-react";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const useMock = isMockMode();
  const data = useQuery(api.users.adminGetProfile, { profileId: id as Id<"profiles"> });
  const setRole = useMutation(api.users.setUserRole);

  if (useMock) {
    return (
      <div className="p-8">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">Mock mode.</div>
      </div>
    );
  }
  if (data === undefined) {
    return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (data === null) {
    return <div className="p-8 text-red-600">Usuario no encontrado</div>;
  }

  const { profile, prs, myRaces, votes, ratings } = data;

  const toggleRole = async () => {
    const newRole = profile.role === "admin" ? "user" : "admin";
    if (confirm(`¿Cambiar rol de ${profile.displayName ?? profile.clerkUserId} a "${newRole}"?`)) {
      await setRole({ profileId: profile._id, role: newRole });
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/users" className="text-sm text-gray-500 hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Volver a usuarios
      </Link>

      <div className="bg-white border rounded-lg p-6 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-runner-primary text-white flex items-center justify-center text-2xl font-bold">
            {(profile.displayName ?? profile.clerkUserId).charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.displayName ?? "(sin nombre)"}</h1>
            <p className="text-sm text-gray-500 font-mono">{profile.clerkUserId}</p>
            <p className="text-xs text-gray-400 mt-1">
              Alta: {new Date(profile._creationTime).toLocaleString("es-ES")}
              {profile.club && ` · Club: ${profile.club}`}
            </p>
          </div>
        </div>
        <button
          onClick={toggleRole}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold ${
            profile.role === "admin"
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-runner-primary text-white hover:opacity-90"
          }`}
        >
          {profile.role === "admin" ? (
            <><ShieldOff className="h-4 w-4" /> Quitar admin</>
          ) : (
            <><Shield className="h-4 w-4" /> Hacer admin</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <MiniStat label="PRs" value={prs.length} icon={Trophy} color="orange" />
        <MiniStat label="Carreras" value={myRaces.length} icon={Calendar} color="purple" />
        <MiniStat label="Votos" value={votes.length} icon={ThumbsUp} color="green" />
        <MiniStat label="Ratings" value={ratings.length} icon={Star} color="blue" />
      </div>

      <Section title="PRs (Marcas personales)">
        {prs.length === 0 ? (
          <Empty msg="Sin PRs registrados" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr><th className="text-left py-1">Distancia</th><th className="text-left">Tiempo</th><th className="text-left">Fecha</th></tr>
            </thead>
            <tbody>
              {prs.map((p) => (
                <tr key={p._id} className="border-t">
                  <td className="py-2">{p.distanceLabel}</td>
                  <td className="font-mono">{formatTime(p.timeSeconds)}</td>
                  <td className="text-gray-500 text-xs">{p.achievedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Su calendario">
        {myRaces.length === 0 ? (
          <Empty msg="Sin carreras en su calendario" />
        ) : (
          <div className="space-y-1 text-sm">
            {myRaces.map((m) => (
              <div key={m._id} className="flex items-center justify-between py-1 border-b last:border-0">
                <span className="font-mono text-xs text-gray-400">{String(m.raceId).slice(0, 8)}</span>
                <span className="flex-1 mx-3">
                  {m.status} · dorsal {m.dorsalNumber ?? "—"}
                </span>
                <span className="text-xs text-gray-400">
                  {m.predictedTimeSeconds ? `pred: ${formatTime(m.predictedTimeSeconds)}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Engagement">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Votos ({votes.length})</div>
            {votes.length === 0 ? <Empty msg="Sin votos" /> : (
              <ul className="space-y-1">
                {votes.slice(0, 10).map((v) => (
                  <li key={v._id} className="text-xs">
                    {v.vote === "up" ? "👍" : "👎"} {String(v.raceId).slice(0, 8)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Ratings 8D ({ratings.length})</div>
            {ratings.length === 0 ? <Empty msg="Sin ratings" /> : (
              <ul className="space-y-1">
                {ratings.slice(0, 10).map((r) => (
                  <li key={r._id} className="text-xs">
                    ⭐ {String(r.raceId).slice(0, 8)} · global {r.organization ?? "—"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-400 italic">{msg}</p>;
}

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  const colors: Record<string, string> = {
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
      <div className={`p-2 rounded-md ${colors[color]}`}><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
