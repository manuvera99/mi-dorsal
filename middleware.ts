import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { gzipSync } from "fflate";

/**
 * Rutas protegidas: requieren auth.
 */
const isProtectedRoute = createRouteMatcher([
  "/calendario(.*)",
  "/perfil(.*)",
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
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/test-geo(.*)",
]);

/**
 * Cache en modulo-level para el body comprimido de la home.
 * Sobrevive entre requests en el mismo edge instance (warm).
 * TTL alineado con `revalidate: 300` de app/page.tsx.
 */
type CachedBody = {
  body: Uint8Array;
  contentType: string;
  compressedAt: number;
};
let cachedHome: CachedBody | null = null;
const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Devuelve la response gzip de la home desde cache o fetch+compress.
 * Usa fflate (libreria JS pura, edge-compatible) en lugar de CompressionStream,
 * que Next.js marca como "Node.js API" y no se compila bien en edge runtime.
 */
async function compressedHomeResponse(
  homeReq: NextRequest
): Promise<NextResponse | null> {
  // Cache hit: respuesta inmediata (~1ms)
  if (cachedHome && Date.now() - cachedHome.compressedAt < HOME_CACHE_TTL_MS) {
    return new NextResponse(cachedHome.body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": cachedHome.contentType,
        "Content-Encoding": "gzip",
        "Vary": "Accept-Encoding",
        "Cache-Control": "public, max-age=60, s-maxage=60, must-revalidate",
        "X-Compressed-By": "mi-dorsal-edge-fflate",
      },
    });
  }
  // Cache miss: fetch al HTML sin compresion para comprimirlo nosotros
  try {
    const internalRes = await fetch(homeReq.url, {
      headers: {
        "accept-encoding": "identity",
        "x-edge-bypass": "1", // evita loop en este mismo middleware
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!internalRes.ok) return null;
    const contentType =
      internalRes.headers.get("content-type") || "text/html; charset=utf-8";
    if (!contentType.includes("text/html")) return null;
    const raw = new Uint8Array(await internalRes.arrayBuffer());
    // fflate.gzipSync: JS puro, sin dependencias nativas, edge-compatible
    const compressed = gzipSync(raw, { level: 6 });
    cachedHome = {
      body: compressed,
      contentType,
      compressedAt: Date.now(),
    };
    return new NextResponse(compressed as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Encoding": "gzip",
        "Vary": "Accept-Encoding",
        "Cache-Control": "public, max-age=60, s-maxage=60, must-revalidate",
        "X-Compressed-By": "mi-dorsal-edge-fflate",
      },
    });
  } catch {
    return null;
  }
}

export default clerkMiddleware(async (auth, req) => {
  // Bypass para fetch interno (evita loop infinito al pedir el HTML sin comprimir)
  if (req.headers.get("x-edge-bypass") === "1") {
    return NextResponse.next();
  }

  // 1) Auth
  if (isProtectedRoute(req) || isAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // 2) Home (/): comprimir manualmente con gzip.
  //    Vercel NO comprime el HTML estatico de ISR (revalidate: 300), asi que
  //    sin esto el HTML se transfiere sin comprimir (~87 KB). Con este
  //    middleware se sirve a ~17 KB. Cache en memoria del edge (warm) para
  //    evitar el coste de comprimir en cada request.
  if (
    req.nextUrl.pathname === "/" &&
    req.method === "GET" &&
    (req.headers.get("accept-encoding") || "").includes("gzip")
  ) {
    const compressed = await compressedHomeResponse(req);
    if (compressed) return compressed;
    // Si falla la compresion, fallback a NextResponse.next() (Vercel sirve sin comprimir)
  }

  // 3) Headers de seguridad + noindex en rutas privadas
  const response = NextResponse.next();
  if (isPrivateRoute(req)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  return response;
});

export const config = {
  // Ejecutar en todas las rutas excepto estaticos y API internos
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
