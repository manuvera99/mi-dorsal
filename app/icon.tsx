import { ImageResponse } from "next/og";

// Route segment config: necesario para que no se prerenderice y se sirva en cada request
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          position: "relative",
        }}
      >
        {/* Dorsal (rectángulo rojo) */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 4,
            right: 4,
            bottom: 2,
            background: "#dc2626",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: -1,
            lineHeight: 1,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          m
        </div>
        {/* Imperdibles arriba */}
        <div
          style={{
            position: "absolute",
            top: 1,
            left: 7,
            width: 3,
            height: 3,
            background: "#0a0a0a",
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 1,
            right: 7,
            width: 3,
            height: 3,
            background: "#0a0a0a",
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
