"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";

// Acceso DIRECTO a process.env.NEXT_PUBLIC_*: Next.js hace inline replacement
// en build time SOLO si el patrón es detectable estáticamente (no dentro
// de funciones helper). Si lo metieras en una función, el bundle del
// cliente acabaría con `process.env.X` literal y fallaría en runtime.

// `convex` se inicializa una vez a nivel de módulo (no por render).
// En SSR: process existe, retorna la URL.
// En cliente: Next.js ya reemplazó NEXT_PUBLIC_CONVEX_URL con el literal.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Acceso directo (mismo motivo: inline replacement en build time).
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Mock mode: skip Clerk and Convex, return children directly
  if (useMock) {
    return <>{children}</>;
  }

  // Real mode: require Clerk key
  if (!clerkPublishableKey) {
    console.warn(
      "[ConvexClientProvider] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Falling back to mock mode for local dev.",
    );
    return <>{children}</>;
  }

  if (!convex) {
    console.warn(
      "[ConvexClientProvider] NEXT_PUBLIC_CONVEX_URL is missing. Falling back to mock mode.",
    );
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
