"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";
import { Search, Users as UsersIcon, Shield, Loader2, Trophy, Calendar } from "lucide-react";

function MockUsersList() {
  return (
    <div className="p-8">
      <Header />
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — gestión de usuarios no disponible. Conecta con Convex para ver la lista real.
      </div>
    </div>
  );
}

function RealUsersList() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "user" | "admin">("all");
  const profiles = useMock ? null : useQuery(api.users.adminListProfiles, {
    search: search || undefined,
    role: role === "all" ? undefined : (role as any),
  });

  return (
    <div className="p-8">
      <Header />

      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o clerkUserId…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
        >
          <option value="all">Todos los roles</option>
          <option value="user">Usuarios</option>
          <option value="admin">Admins</option>
        </select>
        <div className="text-sm text-gray-500 ml-auto">
          {profiles === undefined || profiles === null ? "…" : `${profiles.length} usuarios`}
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {profiles === undefined || profiles === null ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No hay usuarios</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Clerk ID</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Alta</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {profiles.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-runner-primary text-white flex items-center justify-center text-sm font-bold">
                        {(p.displayName ?? p.clerkUserId).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{p.displayName ?? "(sin nombre)"}</div>
                        {p.bio && <div className="text-xs text-gray-400">{p.bio.slice(0, 40)}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.clerkUserId.slice(0, 16)}…</td>
                  <td className="px-4 py-3">
                    {p.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-runner-primary text-white px-2 py-0.5 rounded">
                        <Shield className="h-3 w-3" /> admin
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.club ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(p._creationTime).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${p._id}`}
                      className="text-xs text-runner-primary hover:underline"
                    >
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold">Usuarios</h1>
        <p className="text-gray-600 text-sm">Lista de corredores registrados</p>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return isMockMode() ? <MockUsersList /> : <RealUsersList />;
}
