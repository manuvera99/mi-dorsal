"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Trophy, Calendar, User, BarChart3, Home } from "lucide-react";

export function Header({ mockMode = false }: { mockMode?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-runner-primary text-white font-bold">
            m
          </div>
          <span className="text-lg font-bold tracking-tight">mi-dorsal</span>
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
        </div>
      </div>
    </header>
  );
}
