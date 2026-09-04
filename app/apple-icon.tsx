import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          position: "relative",
        }}
      >
        {/* Hilo curvo (línea que conecta los imperdibles) */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 36,
            right: 36,
            height: 3,
            background: "#0a0a0a",
            borderRadius: 2,
            transform: "rotate(-2deg)",
          }}
        />
        {/* Imperdibles */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 30,
            width: 12,
            height: 12,
            background: "#0a0a0a",
            borderRadius: 12,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 22,
            right: 30,
            width: 12,
            height: 12,
            background: "#0a0a0a",
            borderRadius: 12,
          }}
        />
        {/* Dorsal */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 28,
            right: 28,
            bottom: 24,
            background: "#dc2626",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: -6,
            lineHeight: 1,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          m
        </div>
      </div>
    ),
    { ...size }
  );
}
