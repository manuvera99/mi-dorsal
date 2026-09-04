import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rutas protegidas: requieren auth
const isProtectedRoute = createRouteMatcher([
  "/calendario(.*)",
  "/perfil(.*)",
]);

// Rutas admin: requieren rol admin
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
]);

// Rutas que NO deben indexarse en Google (añadimos header X-Robots-Tag)
// además de las que ya bloquea robots.txt
const isPrivateRoute = createRouteMatcher([
  "/admin(.*)",
  "/calendario(.*)",
  "/perfil(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/test-geo(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 1) Auth
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

  // 3) HSTS también en dev (no duele)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  return response;
});

export const config = {
  // Ejecutar en todas las rutas excepto estáticos y API internos
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
