"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { Trophy, Users, ThumbsUp, MessageSquare, Calendar, MapPin, Loader2 } from "lucide-react";

function MockDashboard() {
  // En mock mode, mostramos valores hardcoded representativos
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-8">Resumen general de la plataforma</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Carreras totales" value="41" icon={Trophy} color="orange" sub="12 hand-crafted + 29 scraped" />
        <StatCard label="Usuarios" value="—" icon={Users} color="blue" sub="Mock mode" />
        <StatCard label="Votos" value="11.6k" icon={ThumbsUp} color="green" sub="Curados en mock" />
        <StatCard label="PRs registrados" value="3" icon={Calendar} color="purple" sub="Manu Vera" />
      </div>
    </div>
  );
}

function RealDashboard() {
  const stats = useQuery(api.users.adminGetStats);
  if (stats === undefined) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  const topProvinces = Object.entries(stats.racesByProvince)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-8">Resumen general de la plataforma</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Carreras"
          value={stats.totalRaces}
          icon={Trophy}
          color="orange"
          sub={`${stats.publishedRaces} publicadas · ${stats.featuredRaces} destacadas`}
        />
        <StatCard
          label="Usuarios"
          value={stats.totalUsers}
          icon={Users}
          color="blue"
          sub={`${stats.adminUsers} admin · ${stats.totalUsers - stats.adminUsers} usuario`}
        />
        <StatCard
          label="Engagement"
          value={stats.totalVotes + stats.totalRatings}
          icon={ThumbsUp}
          color="green"
          sub={`${stats.totalVotes} votos · ${stats.totalRatings} ratings 8D`}
        />
        <StatCard
          label="Calendarios"
          value={stats.totalMyRaces}
          icon={Calendar}
          color="purple"
          sub={`${stats.totalPRs} PRs · ${stats.totalNotifications} emails`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-runner-primary" /> Top provincias
          </h2>
          {topProvinces.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos aún</p>
          ) : (
            <div className="space-y-2">
              {topProvinces.map(([p, n]) => (
                <div key={p} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{p}</span>
                  <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-runner-primary"
                      style={{ width: `${(n / (topProvinces[0][1] || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono w-8 text-right">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Accesos rápidos</h2>
          <div className="space-y-2">
            <Link
              href="/admin/races"
              className="block p-3 rounded-md hover:bg-gray-50 border transition-colors"
            >
              <div className="font-medium text-sm">Ver todas las carreras</div>
              <div className="text-xs text-gray-500">Lista completa, búsqueda, filtros</div>
            </Link>
            <Link
              href="/admin/races/new"
              className="block p-3 rounded-md hover:bg-gray-50 border transition-colors"
            >
              <div className="font-medium text-sm">+ Añadir carrera nueva</div>
              <div className="text-xs text-gray-500">Crear manualmente con todos los campos</div>
            </Link>
            <Link
              href="/admin/users"
              className="block p-3 rounded-md hover:bg-gray-50 border transition-colors"
            >
              <div className="font-medium text-sm">Ver usuarios</div>
              <div className="text-xs text-gray-500">Lista de corredores registrados</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color: "orange" | "blue" | "green" | "purple";
}) {
  const colors: Record<string, string> = {
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-md ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  return isMockMode() ? <MockDashboard /> : <RealDashboard />;
}
