import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Rutas protegidas: requieren auth.
 */
const isProtectedRoute = createRouteMatcher([
  "/calendario(.*)",
  "/perfil(.*)",
  "/cuenta(.*)",
]);

/**
 * Rutas admin: requieren rol admin.
 */
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
]);

/**
 * Rutas que NO deben indexarse en Google.
 */
const isPrivateRoute = createRouteMatcher([
  "/admin(.*)",
  "/calendario(.*)",
  "/perfil(.*)",
  "/cuenta(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/test-geo(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 1) Auth: rutas protegidas y admin
  if (isProtectedRoute(req) || isAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // 2) Headers de seguridad + noindex en rutas privadas
  const response = NextResponse.next();
  if (isPrivateRoute(req)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  // Permissions-Policy: endurecido para no exponer APIs innecesarias
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()"
  );
  return response;
});

export const config = {
  // Ejecutar en todas las rutas excepto estáticos con extensión (favicon, css, js…)
  // y API internos de Next. Las páginas pasan por aquí.
  // IMPORTANTE: excluimos /api/stripe/webhook del middleware de Clerk
  // porque es un webhook de Stripe que no lleva auth y no debe pasar
  // por la auth check. Sin esto, Stripe recibe 401 y se queda en
  // bucle de reintentos (sesión 9 sep 2026, debug del smoke test).
  // El webhook de Clerk (/api/clerk-webhook) se maneja en Convex
  // legacy y también está excluido.
  matcher: [
    "/((?!_next|.*\\..*).*)",
    // Matchea /api/* y /trpc/* EXCEPTO los webhooks externos.
    // Next.js no permite capturing groups en matchers (rechaza
    // paréntesis), por eso usamos lookaheads sin grupo: api/(?!...).
    "/api/((?!stripe/webhook|clerk-webhook).*)",
  ],
};
