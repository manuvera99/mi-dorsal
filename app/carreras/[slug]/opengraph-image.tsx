import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Tamaño estándar Open Graph / Twitter Card.
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";
// Next cachea las imagenes por hash del content; dejamos el default.
// Cada carrera tiene su propia imagen con nombre + fecha + localidad.
// Nota: Next genera cada imagen bajo demanda (lazy) — no rompe el build.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

/**
 * Indica a Next qué imagenes existen.
 * - `slug` viene del segmento de ruta
 * - Para carreras: el slug se valida contra Convex (devolvemos la lista solo
 *   si Convex responde, sino `[]` → Next cae al fallback de metadata base)
 * - Si Convex falla, devolvemos un set minimo (`top`) para no tumbar el
 *   sitemap de imagenes.
 */
export async function generateImageMetadata({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const race: any = await convex.query(api.races.getBySlugForSeo, {
      slug: params.slug,
    });
    if (!race) return [];
    return [
      {
        id: params.slug,
        alt: `Cartel de ${race.name}`,
        contentType: "image/png",
        size,
      },
    ];
  } catch {
    // Si Convex esta caido, Next no genera imagen — cae al og-image.png
    // generico de /public. Es comportamiento aceptable.
    return [];
  }
}

/**
 * Render de la OG image 1200×630.
 * Diseno:
 *  - Fondo dark #0a0a0a (alineado con brand)
 *  - Dorsal estilizado a la izquierda: rectangulo blanco con borde rojo
 *    y numero gigante (hash determinista del slug → mismo dorsal siempre
 *    para la misma carrera, lo que ayuda al reconocimiento de marca)
 *  - Derecha: nombre de la carrera (3 lineas max), fecha + distancia +
 *    localidad, branding "mi-dorsal" abajo
 *  - Acento rojo #dc2626 (runner-primary)
 *
 * Solo se ejecuta server-side (en build si Next lo decide, o bajo demanda).
 * No usa fuentes externas (limitación de next/og en runtime) — todo texto
 * se pinta con la fuente por defecto, que es perfectamente legible.
 */
export default async function Image({ params }: { params: { slug: string } }) {
  // Dorsal determinista del slug: hash 0-999 estable
  const dorsal = Math.abs(
    params.slug.split("").reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7),
  ) % 1000;

  // Carga de datos SEO (mismo patron que generateMetadata y page.tsx)
  let race: any = null;
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    race = await convex.query(api.races.getBySlugForSeo, { slug: params.slug });
  } catch {
    // Si falla, pintamos un placeholder con el slug.
  }

  const name = race?.name ?? params.slug;
  const locality = race?.locality ?? "";
  const startDate = race?.startDate
    ? new Date(race.startDate).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const distanceKm = race?.distanceKm
    ? `${race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km`
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0a0a0a",
          color: "#fafaf9",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Dorsal estilizado a la izquierda */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 460,
            height: "100%",
            backgroundColor: "#fafaf9",
            color: "#0a0a0a",
            borderRight: "8px solid #dc2626",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 380,
              height: 480,
              border: "6px solid #dc2626",
              backgroundColor: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: 4,
                color: "#dc2626",
                marginBottom: 12,
              }}
            >
              mi-dorsal
            </div>
            <div
              style={{
                fontSize: 220,
                fontWeight: 900,
                lineHeight: 1,
                color: "#0a0a0a",
              }}
            >
              {String(dorsal).padStart(3, "0")}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: "#525252",
                marginTop: 16,
                letterSpacing: 2,
              }}
            >
              DORSAL
            </div>
          </div>
        </div>

        {/* Texto a la derecha */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 60px 60px 60px",
            width: 740,
            height: "100%",
          }}
        >
          {/* Cabecera: tagline */}
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 500,
              color: "#dc2626",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            El hilo que te une a tu dorsal
          </div>

          {/* Centro: nombre + meta */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                display: "flex",
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1.1,
                color: "#fafaf9",
              }}
            >
              {name.length > 70 ? `${name.slice(0, 67)}...` : name}
            </div>
            <div
              style={{
                display: "flex",
                gap: 24,
                fontSize: 30,
                fontWeight: 500,
                color: "#a3a3a3",
              }}
            >
              {startDate && (
                <div style={{ display: "flex" }}>📅 {startDate}</div>
              )}
              {distanceKm && (
                <div style={{ display: "flex" }}>🏃 {distanceKm}</div>
              )}
              {locality && (
                <div style={{ display: "flex" }}>📍 {locality}</div>
              )}
            </div>
          </div>

          {/* Footer: branding + URL */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: 22,
              color: "#737373",
            }}
          >
            <div style={{ display: "flex", fontWeight: 600, color: "#fafaf9" }}>
              mi-dorsal.com
            </div>
            <div style={{ display: "flex", fontSize: 20 }}>
              carreras populares · España
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}