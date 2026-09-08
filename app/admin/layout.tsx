"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Database,
  ArrowLeft,
  Loader2,
  BookOpen,
  Mail,
  Copy,
  Inbox,
  MessageCircle,
  Building2,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "midorsal:admin:sidebarCollapsed";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/races", label: "Carreras", icon: Trophy },
  { href: "/admin/race-suggestions", label: "Sugerencias", icon: Inbox },
  { href: "/admin/feedback", label: "Feedback", icon: MessageCircle },
  { href: "/admin/club-suggestions", label: "Clubes sugeridos", icon: Building2 },
  { href: "/admin/clubs", label: "Clubes manuales", icon: Tag },
  { href: "/admin/duplicates", label: "Duplicados", icon: Copy },
  { href: "/admin/blog", label: "Blog", icon: BookOpen },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/ai-usage", label: "Uso de IA", icon: Sparkles },
  { href: "/admin/sources", label: "Fuentes", icon: Database },
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

  // Estado del sidebar: colapsado (iconos) o expandido (iconos + label). Persistido en localStorage.
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* localStorage no disponible (modo privado, etc.) — fallback a expandido */
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* sin persistencia, no pasa nada */
      }
      return next;
    });
  };

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

  const sidebarWidthClass = collapsed ? "w-16" : "w-64";
  const sidebarLabelClass = collapsed ? "hidden" : "inline";

  return (
    <div className="min-h-screen flex">
      <aside
        className={`${sidebarWidthClass} bg-gray-900 text-white flex-shrink-0 transition-[width] duration-200 ease-in-out flex flex-col`}
        aria-label="Navegación del panel de administración"
      >
        <div
          className={`border-b border-gray-800 flex items-center ${
            collapsed ? "justify-center p-3" : "justify-between p-6"
          }`}
        >
          {!collapsed && (
            <div>
              <Link
                href="/"
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-3"
              >
                <ArrowLeft className="h-3 w-3" /> Volver a la app
              </Link>
              <h1 className="text-lg font-bold">mi-dorsal admin</h1>
              <p className="text-xs text-gray-400 mt-1">Panel de administración</p>
              {useMock && (
                <span className="badge badge-yellow text-xs mt-2 inline-block">MOCK MODE</span>
              )}
            </div>
          )}
          {hydrated && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600"
              aria-label={collapsed ? "Expandir menú lateral" : "Comprimir menú lateral"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expandir menú" : "Comprimir menú"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        <nav className="p-2 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-runner-primary text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className={sidebarLabelClass}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {!collapsed && (
          <div className="p-4">
            <p className="text-xs text-gray-500">v0.1 · {new Date().getFullYear()}</p>
          </div>
        )}
      </aside>
      <main className="flex-1 bg-gray-50 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
