"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";

// Helper: leer process.env de forma segura en build time (SSR) y cliente.
// En build time: `process` existe, retorna process.env[key].
// En cliente: Next.js reemplaza NEXT_PUBLIC_* inline (literal), por lo que
// `process.env[key]` ya no es un acceso sino un valor estático.
// Si por algún motivo la var no se reemplazó, `process` no existe en
// navegador y `process.env[key]` lanza ReferenceError → capturamos y undefined.
function readEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

const convexUrl = readEnv("NEXT_PUBLIC_CONVEX_URL");
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const useMock = readEnv("NEXT_PUBLIC_USE_MOCK") === "true";
  const clerkPublishableKey = readEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");

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
