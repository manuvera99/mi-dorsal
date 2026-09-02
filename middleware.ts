import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rutas protegidas: requieren auth
const isProtectedRoute = createRouteMatcher([
  "/calendario(.*)",
  "/perfil(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Ejecutar en todas las rutas excepto estáticos y API internos
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
