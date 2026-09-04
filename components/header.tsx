"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import { Trophy, Calendar, User, BarChart3, Home, Shield, ArrowLeftRight, Menu, X } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Si true, también marca como activo cualquier ruta que empiece por `href`. */
  matchPrefix?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/carreras", label: "Carreras", icon: Trophy, matchPrefix: true },
  { href: "/ranking", label: "Ranking", icon: BarChart3, matchPrefix: true },
  { href: "/calendario", label: "Mi calendario", icon: Calendar, matchPrefix: true },
  { href: "/perfil", label: "Perfil", icon: User, matchPrefix: true },
];

/**
 * Hook condicional: solo ejecuta la función si NO estamos en mock.
 * Útil para Clerk hooks (useUser) y Convex hooks que fallan en mock.
 */
function useMockSafe<T>(fn: () => T, useMock: boolean): T | null {
  if (useMock) return null;
  return fn();
}

export function Header({ mockMode = false }: { mockMode?: boolean }) {
  const useMock = isMockMode();
  // useUser y useQuery solo se llaman si NO estamos en mock
  // (en mock, ClerkProvider no envuelve la app y useUser fallaría)
  const userResult = useMockSafe(() => useUser(), useMock);
  const isSignedIn = userResult?.isSignedIn ?? false;
  const myProfile = useMockSafe(() => useQuery(api.users.getMyProfile), useMock);
  const isAdminReal = myProfile?.role === "admin";
  // En mock mode, mostramos admin siempre para que el dev pueda acceder
  // sin tener que configurar Clerk. En producción, requiere role="admin".
  const showAdminLink = useMock ? true : isAdminReal;

  // Estado del menú móvil
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Cerrar el menú al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Cerrar con Escape + lock de scroll del body cuando está abierto
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  const isActive = (item: NavItem) => {
    if (!pathname) return false;
    if (item.href === "/") return pathname === "/";
    return item.matchPrefix ? pathname === item.href || pathname.startsWith(item.href + "/") : pathname === item.href;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="mi-dorsal — inicio">
          {/* Isotipo (dorsal rojo con speed lines) — public/brand-assets/isotipo-mono-black.png */}
          <img
            src="/favicon-48x48.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9"
            aria-hidden="true"
          />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-runner-dark">mi</span>
            <span className="text-gray-400 font-light">-</span>
            <span className="text-runner-primary">dorsal</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/" className="flex items-center gap-1.5 text-gray-700 hover:text-runner-primary transition-colors">
            <Home className="h-4 w-4" /> Inicio
          </Link>
          <Link href="/carreras" className="flex items-center gap-1.5 text-gray-700 hover:text-runner-primary transition-colors">
            <Trophy className="h-4 w-4" /> Carreras
          </Link>
          <Link href="/ranking" className="flex items-center gap-1.5 text-gray-700 hover:text-runner-primary transition-colors">
            <BarChart3 className="h-4 w-4" /> Ranking
          </Link>
          <Link href="/calendario" className="flex items-center gap-1.5 text-gray-700 hover:text-runner-primary transition-colors">
            <Calendar className="h-4 w-4" /> Mi calendario
          </Link>
          <Link href="/perfil" className="flex items-center gap-1.5 text-gray-700 hover:text-runner-primary transition-colors">
            <User className="h-4 w-4" /> Perfil
          </Link>
          {/* Cross-link a DorsalSwap — OCULTO por ahora (Sprint 0).
              Se re-activará cuando DorsalSwap tenga tracción validada. */}
          {false && (
            <a
              href={process.env.NEXT_PUBLIC_DORSWAP_URL || "https://dorsalswap.vercel.app"}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-swap-700 bg-swap-50 hover:bg-swap-100 transition-colors"
              title="Ir a DorsalSwap — cede o encuentra tu dorsal"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              DorsalSwap
            </a>
          )}
          {showAdminLink && (
            <Link href="/admin" className="flex items-center gap-1.5 text-runner-primary font-semibold hover:opacity-80 transition-colors">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {mockMode ? (
            <span className="badge badge-gray text-xs" title="Modo mock — datos de ejemplo, no se persisten">
              MOCK
            </span>
          ) : (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="text-sm font-medium text-gray-700 hover:text-runner-primary transition-colors px-3 py-1.5">
                    Entrar
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="text-sm font-semibold bg-runner-primary text-white px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
                    Crear cuenta
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8",
                    },
                  }}
                />
              </SignedIn>
            </>
          )}

          {/* Hamburguesa — solo visible en móvil (<md). En desktop la nav ya está visible. */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu-panel"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Panel del menú móvil (slide-down). Vive dentro del <header>
          sticky para que scrollee junto al header y no se corte si un
          padre tuviese overflow-hidden. Cierra con Escape, al cambiar de
          ruta o al pulsar un enlace. */}
      <div
        id="mobile-menu-panel"
        className={`md:hidden border-t border-gray-200 bg-white overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          mobileMenuOpen ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <nav className="flex flex-col px-2 py-2" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-runner-primary/10 text-runner-primary"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          {showAdminLink && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-semibold text-runner-primary hover:bg-gray-50 transition-colors"
            >
              <Shield className="h-5 w-5" aria-hidden="true" />
              Admin
            </Link>
          )}
          <div className="my-2 border-t border-gray-100" />
          <p className="px-3 py-1 text-xs text-gray-500">
            El hilo que te une a tu dorsal.
          </p>
        </nav>
      </div>
    </header>
  );
}
