/**
 * DEPRECATED — endpoint eliminado.
 *
 * La geolocalización por IP fue retirada de `components/race-distance-filter.tsx`
 * porque devolvía la IP del servidor Vercel (Frankfurt) en lugar de la del
 * cliente. Para filtrar carreras por distancia ahora usamos:
 *  - GPS del navegador (con permiso)
 *  - Selector de ciudades (1 click)
 *  - Coordenadas manuales
 *
 * Mantenemos este archivo como placeholder para no romper imports antiguos.
 * Devuelve 410 Gone.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Gone",
      message: "Geolocation by IP is no longer supported. Use browser GPS, the city selector, or manual coordinates.",
    },
    { status: 410 },
  );
}
