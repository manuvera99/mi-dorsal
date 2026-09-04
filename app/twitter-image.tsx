import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "mi-dorsal — Planifica tu temporada de carreras";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fafaf9 0%, #fef2f2 100%)",
          padding: 60,
          fontFamily: "system-ui, -apple-system, sans-serif",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 70,
              height: 88,
              background: "#dc2626",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: -3,
            }}
          >
            m
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: "#0a0a0a", letterSpacing: -2 }}>mi</span>
            <span style={{ fontSize: 52, fontWeight: 300, color: "#525252", margin: "0 4px" }}>-</span>
            <span style={{ fontSize: 52, fontWeight: 800, color: "#dc2626", letterSpacing: -2 }}>dorsal</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#0a0a0a",
            letterSpacing: -1.5,
            lineHeight: 1.05,
            maxWidth: 1000,
          }}
        >
          Planifica tu temporada de carreras
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#525252",
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          Predice tu tiempo, recibe tu resultado oficial y diploma por email.
        </div>
      </div>
    ),
    { ...size }
  );
}
