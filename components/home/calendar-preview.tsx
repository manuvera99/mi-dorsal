/**
 * CalendarPreview — sección de la home (v3.3, sep 2026).
 *
 * Reemplaza al DiplomaAndSharePreview: el usuario quiere destacar el
 * calendario de carreras con prediccion (tiempo objetivo por carrera)
 * en lugar del diploma + sticker que recibia al cruzar la meta.
 *
 * El diploma y el sticker siguen existiendo como feature real (siguen
 * llegando al usuario por email), solo se ha dejado de promocionarlos
 * en la home. Si en el futuro queremos volver a mostrarlos, se restaura
 * el DiplomaAndSharePreview (sigue en components/home/diploma-preview.tsx,
 * sin uso).
 *
 * Stack: server component declarativo. Sin fetches. Sin JS. El CTA lleva
 * a /calendario (vista privada con auth de Clerk).
 */

import Link from "next/link";
import { Calendar, ArrowRight, Clock } from "lucide-react";

// Mockup: 4 carreras con prediccion. Datos representativos, NO reales.
// Formato del tiempo igual al de lib/pdf/diploma.tsx (HH:MM:SS).
const MY_RACES_MOCK = [
  {
    date: "12 NOV",
    name: "Behobia-San Sebastián",
    place: "San Sebastián",
    distance: "20 km",
    predictedTime: "01:26:14",
    confidence: "high",
  },
  {
    date: "23 NOV",
    name: "Carrera de la Mujer",
    place: "Valencia",
    distance: "6,3 km",
    predictedTime: "00:28:42",
    confidence: "medium",
  },
  {
    date: "14 DIC",
    name: "Cumbres Trail Alicante",
    place: "Alicante",
    distance: "21 km",
    predictedTime: "01:48:30",
    confidence: "medium",
  },
  {
    date: "26 ENE",
    name: "San Silvestre Valencia",
    place: "Valencia",
    distance: "5 km",
    predictedTime: "00:22:18",
    confidence: "high",
  },
];

export function CalendarPreview() {
  return (
    <section
      className="py-10 md:py-14"
      aria-labelledby="calendar-title"
      style={{ background: "#fafaf9" }}
    >
      <div className="container">
        <div
          className="mb-10 md:mb-12 mx-auto"
          style={{ maxWidth: "720px", paddingInline: "1.25rem" }}
        >
          <p
            className="mb-3"
            style={{
              color: "#dc2626",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Tu hilo de carrera
          </p>
          <h2
            id="calendar-title"
            className="font-bold"
            style={{
              fontFamily: "var(--font-display, 'Sora', system-ui)",
              color: "#0a0a0a",
              letterSpacing: "-0.015em",
              lineHeight: 1.12,
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Móntate el calendario y ponle tiempo objetivo a cada dorsal.
          </h2>
          <p
            className="mt-4"
            style={{
              fontSize: "1rem",
              lineHeight: 1.55,
              color: "#1f1f1f",
              textAlign: "center",
              margin: 0,
            }}
          >
            Predicción de tiempo por carrera basada en tu historial. Cuando
            publiquen clasificaciones, comparamos tu tiempo oficial con el
            objetivo.
          </p>
        </div>

        {/* Mockup del calendario — lista de carreras */}
        <div
          className="mx-auto"
          style={{
            maxWidth: "640px",
            paddingInline: "1.25rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px",
              border: "1px solid rgba(10,10,10,0.06)",
              boxShadow: "0 2px 8px rgba(10,10,10,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Header mini del mockup */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid rgba(10,10,10,0.06)",
                background: "#f5f5f4",
              }}
            >
              <div className="flex items-center gap-2">
                <Calendar
                  className="h-4 w-4"
                  style={{ color: "#dc2626" }}
                  aria-hidden="true"
                />
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#0a0a0a",
                  }}
                >
                  Mi calendario
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#525252",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {MY_RACES_MOCK.length} carreras
              </span>
            </div>

            {/* Lista de carreras */}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {MY_RACES_MOCK.map((r, i) => (
                <li
                  key={r.name}
                  className="flex items-center gap-4"
                  style={{
                    padding: "14px 18px",
                    borderBottom:
                      i < MY_RACES_MOCK.length - 1
                        ? "1px solid rgba(10,10,10,0.05)"
                        : "none",
                  }}
                >
                  {/* Fecha */}
                  <div
                    style={{
                      minWidth: "52px",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "#0a0a0a",
                    }}
                  >
                    {r.date}
                  </div>

                  {/* Info carrera */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#0a0a0a",
                        margin: 0,
                        lineHeight: 1.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#525252",
                        margin: "2px 0 0",
                      }}
                    >
                      {r.place} · {r.distance}
                    </p>
                  </div>

                  {/* Tiempo objetivo */}
                  <div
                    className="flex items-center gap-1"
                    style={{ flexShrink: 0 }}
                  >
                    <Clock
                      className="h-3 w-3"
                      style={{ color: "#16a34a" }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: "#16a34a",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {r.predictedTime}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA — lleva a /calendario, Clerk gestiona el sign-in */}
          <div
            className="flex justify-center"
            style={{ marginTop: "2rem" }}
          >
            <Link
              href="/calendario"
              className="inline-flex items-center gap-2 font-semibold transition-colors"
              style={{
                background: "#dc2626",
                color: "#fff",
                padding: "0.85rem 1.6rem",
                borderRadius: "9999px",
                fontSize: "0.9375rem",
              }}
            >
              Ver mi calendario
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}