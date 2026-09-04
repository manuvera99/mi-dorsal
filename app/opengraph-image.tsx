import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "mi-dorsal — Planifica tu temporada de carreras";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #fafaf9 0%, #fef2f2 100%)",
          padding: 80,
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Patrón de fondo: línea de meta sutil */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0px, transparent 40px, rgba(220, 38, 38, 0.04) 40px, rgba(220, 38, 38, 0.04) 80px)",
          }}
        />

        {/* Logo (header) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            position: "relative",
          }}
        >
          {/* Dorsal mini */}
          <div
            style={{
              width: 80,
              height: 100,
              background: "#dc2626",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: -3,
              position: "relative",
              marginTop: 16,
            }}
          >
            {/* Imperdibles */}
            <div
              style={{
                position: "absolute",
                top: -8,
                left: 8,
                width: 8,
                height: 8,
                background: "#0a0a0a",
                borderRadius: 8,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: -8,
                right: 8,
                width: 8,
                height: 8,
                background: "#0a0a0a",
                borderRadius: 8,
              }}
            />
            m
          </div>
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 56, fontWeight: 800, color: "#0a0a0a", letterSpacing: -2 }}>mi</span>
            <span style={{ fontSize: 56, fontWeight: 300, color: "#525252", margin: "0 4px" }}>-</span>
            <span style={{ fontSize: 56, fontWeight: 800, color: "#dc2626", letterSpacing: -2 }}>dorsal</span>
          </div>
        </div>

        {/* Headline principal */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#0a0a0a",
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            Planifica tu temporada de carreras
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#525252",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Predice tu tiempo, recibe tu resultado oficial y diploma por email. El hilo que te une a tu dorsal.
          </div>
        </div>

        {/* Footer con dominio */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              background: "#dc2626",
              borderRadius: 7,
            }}
          />
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#0a0a0a",
            }}
          >
            mi-dorsal.es
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#737373",
              marginLeft: 16,
            }}
          >
            · Carreras, ranking, calendario y resultados del Levante español
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
