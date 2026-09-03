"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { LayoutDashboard, Trophy, Users, BarChart3, ArrowLeft, Loader2 } from "lucide-react";

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
  const isAdminReal = myProfile?.role === "admin";

  // Solo admins pueden ver el panel. Si no, redirigir.
  useEffect(() => {
    if (useMock) return;
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
      return;
    }
    if (myProfile !== undefined && !isAdminReal) {
      router.push("/");
    }
  }, [useMock, isLoaded, isSignedIn, myProfile, isAdminReal, router]);

  const canRender = useMock || isAdminReal;

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
      <main className="flex-1 bg-gray-50 overflow-auto">{children}</main>
    </div>
  );
}
