"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { LayoutDashboard, Trophy, Users, BarChart3, ArrowLeft, Shield, AlertCircle, Loader2 } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/races", label: "Carreras", icon: Trophy },
  { href: "/admin/users", label: "Usuarios", icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const useMock = isMockMode();
  const userResult = useMock ? null : useUser();
  const isLoaded = userResult?.isLoaded ?? true;
  const isSignedIn = userResult?.isSignedIn ?? false;
  const router = useRouter();
  const pathname = usePathname();

  const myProfile = useMock ? null : useQuery(api.users.getMyProfile);
  const publicStats = useQuery(api.users.getPublicStats);
  const isAdminReal = myProfile?.role === "admin";
  const noAdminsYet = publicStats?.adminCount === 0;
  const bootstrap = useMutation(api.users.bootstrapFirstAdmin);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      await bootstrap({});
      // Force re-fetch of profile
      window.location.reload();
    } catch (e: any) {
      setBootstrapError(e.message);
    } finally {
      setBootstrapping(false);
    }
  };

  // Si no es admin y no está en mock, redirigir
  useEffect(() => {
    if (useMock) return;
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
      return;
    }
    // Si no es admin pero hay admins (no puede ser 0), redirigir
    if (myProfile !== undefined && !isAdminReal && publicStats !== undefined && !noAdminsYet) {
      router.push("/");
    }
  }, [useMock, isLoaded, isSignedIn, myProfile, isAdminReal, publicStats, noAdminsYet, router]);

  // Mock mode: siempre puede ver
  // Real mode: si es admin, ve. Si no es admin pero no hay admins aún, ve la pantalla de bootstrap.
  const canRender = useMock || isAdminReal || (publicStats !== undefined && noAdminsYet && isSignedIn);

  if (!canRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-3">Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 text-white flex-shrink-0">
        <div className="p-6 border-b border-gray-800">
          <Link href="/" className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-3">
            <ArrowLeft className="h-3 w-3" /> Volver a la app
          </Link>
          <h1 className="text-lg font-bold">mi-dorsal admin</h1>
          <p className="text-xs text-gray-400 mt-1">Panel de administración</p>
          {useMock && <span className="badge badge-yellow text-xs mt-2 inline-block">MOCK MODE</span>}
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-runner-primary text-white" : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 mt-8">
          <p className="text-xs text-gray-500">v0.1 · {new Date().getFullYear()}</p>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-auto">
        {/* Banner de bootstrap si no hay admins */}
        {!useMock && noAdminsYet && !isAdminReal && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
            <div className="flex items-start gap-3 max-w-4xl mx-auto">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900">No hay admins en el sistema</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Eres el primer usuario. Si quieres ser admin, pulsa el botón. Solo se puede hacer una vez.
                </p>
                {bootstrapError && (
                  <p className="text-sm text-red-600 mt-2">{bootstrapError}</p>
                )}
                <button
                  onClick={handleBootstrap}
                  disabled={bootstrapping}
                  className="mt-3 inline-flex items-center gap-2 bg-runner-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {bootstrapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
 {bootstrapping ? "Promoviendo…" : "Hacerme admin"}
                </button>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
