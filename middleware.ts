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
  // 0) BYPASS para webhooks externos (Stripe, Clerk legacy). Estos
  // servicios no llevan auth y Clerk no debe procesarlos. Sin este
  // bypass, el middleware de Clerk devuelve 401 a Stripe y se queda
  // en bucle de reintentos cada 57 min. Sesión 9 sep 2026.
  // El matcher del config NO soporta lookaheads (Next.js no los
  // acepta), por eso el bypass se hace aquí en el handler.
  const pathname = req.nextUrl.pathname;
  if (
    pathname === "/api/stripe/webhook" ||
    pathname === "/api/stripe/portal" ||
    pathname.startsWith("/api/clerk-webhook")
  ) {
    return NextResponse.next();
  }

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
  // Ejecutar el middleware en todas las rutas excepto estáticos con
  // extensión (favicon, css, js…) y API internos de Next.
  // El bypass de webhooks externos (Stripe, Clerk) se hace dentro
  // del handler porque Next.js no soporta regex con lookaheads
  // en el matcher.
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
