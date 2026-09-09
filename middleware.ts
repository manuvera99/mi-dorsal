import { NextRequest, NextResponse } from "next/server";

/**
 * Webhooks externos (Stripe, Clerk legacy). NO deben pasar por
 * Clerk. Si el pathname matchea uno de estos, retornamos
 * NextResponse.next() sin procesar auth.
 *
 * Sesión 9 sep 2026, debug del smoke test: clerkMiddleware() se
 * ejecuta ANTES del callback que pasamos, así que cualquier bypass
 * dentro del callback es demasiado tarde (ya tenemos 401). Por eso
 * hemos dejado de usar clerkMiddleware() y protegemos las rutas
 * manualmente con auth() en cada Server Component / route handler.
 *
 * Este middleware global solo añade headers de seguridad + bypass
 * de webhooks. NO aplica auth.
 */

/**
 * Helper: devuelve true si el pathname empieza por uno de los
 * prefijos dados. Comparación literal, no regex (Next.js matcher
 * no soporta regex compleja).
 */
function matchesAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 0) Webhooks externos: bypass completo, sin auth ni headers
  //    adicionales (dejamos que el route handler los gestione).
  if (
    pathname === "/api/stripe/webhook" ||
    pathname === "/api/stripe/portal" ||
    pathname.startsWith("/api/clerk-webhook")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // 1) Headers de seguridad en todas las rutas.
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

  // 2) Noindex en rutas privadas
  if (matchesAny(pathname, [
    "/admin",
    "/calendario",
    "/perfil",
    "/cuenta",
    "/sign-in",
    "/sign-up",
    "/test-geo",
  ])) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

/**
 * Matcher: ejecuta el middleware en casi todas las rutas excepto
 * - Estáticos con extensión (favicon, css, js…)
 * - _next (internals de Next)
 * - Webhooks externos: ya los excluimos en el handler, pero los
 *   volvemos a excluir del matcher para evitar coste innecesario.
 */
export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
  ],
};
