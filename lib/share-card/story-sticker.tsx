// =============================================================================
// mi-dorsal — Story sticker PNG (1080x1920, fondo transparente)
// =============================================================================
// Pieza vertical pensada para que el usuario la suba como sticker/overlay en
// Instagram o TikTok Stories, sobre su propia foto de la carrera. Contenido
// reducido a lo esencial: PR (si aplica), tiempo, pace, kilómetros recorridos
// y el logo (discreto, debajo de la fila de datos). Fondo completamente
// transparente — no lleva nombre de carrera, fecha, dorsal grande ni footer
// de dominio (eso vive en el share card 1200x630).
//
// Stack: @vercel/og (satori) → JSX → PNG en Node runtime.
// Mismos tokens de color que lib/share-card/render.tsx.
// =============================================================================

import * as React from "react";
import { ImageResponse } from "@vercel/og";
import { getFonts } from "./fonts";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const C = {
  accent: "#4ade80",
  // Paneles "cristal": relleno casi transparente + borde fino, para que
  // se note la forma pero la foto de fondo del usuario se siga viendo.
  // El texto va en blanco con sombra oscura fuerte (en vez de texto oscuro
  // sobre fondo blanco sólido) para leerse igual sobre fotos claras u
  // oscuras — la traslucidez del panel ya no garantiza un fondo blanco.
  panelBg: "rgba(255, 255, 255, 0.14)",
  panelBorder: "rgba(255, 255, 255, 0.55)",
  prBg: "rgba(74, 222, 128, 0.16)",
  prBorder: "rgba(74, 222, 128, 0.65)",
  textShadow: "0 2px 10px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35)",
} as const;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface StoryStickerProps {
  timeFormatted?: string; // "1:59:25"
  paceFormatted?: string; // "5:40"
  distanceKm?: number; // kilómetros recorridos, ej 21.1
  isPersonalRecord?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDistanceKm(distanceKm: number | undefined): string {
  if (!distanceKm || distanceKm <= 0) return "—";
  return distanceKm.toFixed(1).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Componente (JSX puro compatible con satori)
// ---------------------------------------------------------------------------

function StorySticker(props: StoryStickerProps) {
  return (
    <div
      style={{
        width: "1080px",
        height: "1920px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter",
      }}
    >
      {/* Bloque de contenido centrado */}
      <div
        style={{
          width: "820px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* PR badge (si aplica) */}
        {props.isPersonalRecord ? (
          <div
            style={{
              display: "flex",
              backgroundColor: C.prBg,
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: C.prBorder,
              borderRadius: "999px",
              padding: "12px 28px",
              marginBottom: "24px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "24px",
                fontWeight: 700,
                color: "white",
                letterSpacing: "0.5px",
                textShadow: C.textShadow,
              }}
            >
              🎉 Nuevo PR
            </div>
          </div>
        ) : null}

        {/* Tarjeta: tiempo oficial */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: C.panelBg,
            borderWidth: "1.5px",
            borderStyle: "solid",
            borderColor: C.panelBorder,
            borderRadius: "32px",
            padding: "40px 56px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "12px",
              textShadow: C.textShadow,
            }}
          >
            Tu tiempo oficial
          </div>
          <div
            style={{
              fontSize: "128px",
              fontWeight: 700,
              fontFamily: "JetBrains Mono",
              color: C.accent,
              letterSpacing: "-4px",
              lineHeight: 1,
              textShadow: C.textShadow,
            }}
          >
            {props.timeFormatted ?? "—"}
          </div>
        </div>

        {/* Fila: pace + kilómetros recorridos */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "20px",
            width: "100%",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: C.panelBg,
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: C.panelBorder,
              borderRadius: "24px",
              padding: "28px 20px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "white",
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: "8px",
                textShadow: C.textShadow,
              }}
            >
              Pace
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: "44px",
                fontWeight: 700,
                fontFamily: "JetBrains Mono",
                color: "white",
                textShadow: C.textShadow,
              }}
            >
              {props.paceFormatted ?? "—"}
              <div
                style={{
                  fontSize: "22px",
                  marginLeft: "6px",
                }}
              >
                /km
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: C.panelBg,
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: C.panelBorder,
              borderRadius: "24px",
              padding: "28px 20px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "white",
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: "8px",
                textShadow: C.textShadow,
              }}
            >
              Kilómetros
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: "44px",
                fontWeight: 700,
                fontFamily: "JetBrains Mono",
                color: "white",
                textShadow: C.textShadow,
              }}
            >
              {formatDistanceKm(props.distanceKm)}
              <div
                style={{
                  fontSize: "22px",
                  marginLeft: "6px",
                }}
              >
                km
              </div>
            </div>
          </div>
        </div>

        {/* Logo, justo debajo de la fila de pace/km — un solo color,
            semi-transparente para que se disimule y no compita con los
            datos, que son el foco. */}
        <div
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "1px",
            textShadow: C.textShadow,
          }}
        >
          mi-dorsal
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Renderiza el story sticker como Buffer PNG con fondo transparente.
 * Pensado para subir a Convex Storage y servir como descarga directa desde
 * la página de resultado (no se envía por email).
 */
export async function renderStorySticker(props: StoryStickerProps): Promise<Buffer> {
  const fonts = getFonts();
  const res = new ImageResponse(<StorySticker {...props} />, {
    width: 1080,
    height: 1920,
    fonts,
  });
  return Buffer.from(await res.arrayBuffer());
}
