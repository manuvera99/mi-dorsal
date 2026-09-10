import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Sesión 10 sep 2026 — revertido el intento de la sesión anterior de
 * quitar clerkMiddleware() por completo. Aquel cambio arregló el 401
 * que Stripe recibía en su webhook, pero como efecto secundario rompió
 * TODO lo que llama a auth() server-side (checkout, portal, Strava
 * OAuth, acciones admin): @clerk/nextjs v6 exige que clerkMiddleware()
 * esté activo para que auth() tenga contexto, con sesión o sin ella.
 * Sin él, auth() lanza siempre "Clerk can't detect usage of
 * clerkMiddleware()" → 500 con body vacío.
 *
 * El fix correcto (documentado por Clerk) es excluir del MATCHER las
 * rutas de webhook externas — no interceptarlas dentro del callback,
 * que llega demasiado tarde. Verificado: ninguna de las 4 rutas de
 * webhook (stripe/webhook, webhooks/clerk-billing, webhooks/clerk-users,
 * webhooks/strava) usa auth() de Clerk — todas verifican su propia
 * firma (HMAC/Svix/verify_token), así que excluirlas del matcher no
 * abre ningún hueco de seguridad.
 */
const isProtectedRoute = createRouteMatcher([
  "/calendario(.*)",
  "/perfil(.*)",
  "/cuenta(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

const isPrivateRoute = createRouteMatcher([
  "/admin(.*)",
  "/calendario(.*)",
  "/perfil(.*)",
  "/cuenta(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/test-geo(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // 1) Auth: rutas protegidas y admin
  if (isProtectedRoute(req) || isAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  const response = NextResponse.next();

  // 2) Headers de seguridad en todas las rutas.
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()"
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  // 3) Noindex en rutas privadas
  if (isPrivateRoute(req)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
});

/**
 * Matcher: ejecuta clerkMiddleware en todas las rutas EXCEPTO:
 * - Estáticos con extensión (favicon, css, js…) y _next (internals).
 * - Los 4 webhooks externos (Stripe + Clerk + Strava), que no llevan
 *   sesión de usuario y se autentican con su propia firma.
 *
 * IMPORTANTE: Next.js trata varias entradas del array `matcher` como
 * un OR — si se pusiera esta exclusión en un segundo patrón separado
 * (como se intentó en el commit ef21164, sesión 9 sep 2026), el primer
 * patrón genérico ya matchea los webhooks y los "cuela" de vuelta.
 * Por eso TODAS las exclusiones van en un único lookahead negativo
 * (sin grupo de captura — Next.js no admite paréntesis normales aquí).
 * Verificado con test manual de la regex antes de deployar.
 */
export const config = {
  matcher: [
    "/((?!_next|.*\\..*|api/stripe/webhook|api/webhooks/clerk-billing|api/webhooks/clerk-users|api/webhooks/strava).*)",
  ],
};
