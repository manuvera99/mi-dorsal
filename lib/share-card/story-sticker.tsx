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

// Tokens para la variante "overlay" (descarga de Stories): transparente,
// texto blanco con sombra fuerte — pensado para superponer sobre una foto.
const OVERLAY_TOKENS = {
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
  bg: "transparent",
  text: "white",
  accentText: "#4ade80",
} as const;

// Tokens para la variante "email": fondo crema opaco (igual al body del
// email de mi-dorsal) + textos oscuros en paneles blancos redondeados.
// Pensada para incrustarse inline en el email sobre fondo claro: legible
// aunque el cliente de correo bloquee imágenes (el fondo opaco garantiza
// contraste sin necesidad de cargar el cid).
const EMAIL_TOKENS = {
  accent: "#16a34a", // verde-600 (mismo que COLORS.accent del email)
  panelBg: "#ffffff",
  panelBorder: "#e7e5e4", // --runner-line
  prBg: "#dcfce7", // verde-50
  prBorder: "#16a34a",
  textShadow: "none",
  bg: "#fafaf9", // --runner-warm (crema)
  text: "#0a0a0a", // --runner-dark
  accentText: "#16a34a",
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

/**
 * - "overlay" (default): variante transparente con texto blanco + sombra
 *   fuerte. Pensada para descargar y superponer sobre la foto del usuario
 *   en Instagram/TikTok Stories.
 * - "email": variante con fondo crema opaco + textos oscuros sobre paneles
 *   blancos. Pensada para incrustarse inline en el email de resultado
 *   sobre fondo claro: legible aunque el cliente bloquee imágenes y sin
 *   depender de un wrapper oscuro artificial en el HTML del email.
 */
export type StoryStickerTheme = "overlay" | "email";

export interface RenderStoryStickerOptions {
  theme?: StoryStickerTheme;
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

function StorySticker(props: StoryStickerProps & { theme: StoryStickerTheme }) {
  const C = props.theme === "email" ? EMAIL_TOKENS : OVERLAY_TOKENS;
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
        backgroundColor: C.bg,
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
                color: props.theme === "email" ? "#15803d" : "white", // verde-700 legible sobre verde-50
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
              color: C.text,
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
              color: C.accentText,
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
                color: C.text,
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
                color: C.text,
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
                color: C.text,
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
                color: C.text,
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
            color: props.theme === "email" ? "rgba(10,10,10,0.45)" : "rgba(255,255,255,0.45)",
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
 * Renderiza el story sticker como Buffer PNG.
 *
 * Por defecto (`theme: "overlay"`) genera la variante transparente con
 * texto blanco + sombra fuerte, pensada para descargar y superponer sobre
 * la foto del usuario en Instagram/TikTok Stories.
 *
 * `theme: "email"` genera la variante con fondo crema opaco + textos
 * oscuros sobre paneles blancos, pensada para incrustarse inline en el
 * email de resultado sobre fondo claro: legible aunque el cliente de
 * correo bloquee imágenes, sin depender de un wrapper oscuro artificial
 * en el HTML.
 *
 * El PNG en ambos casos mide 1080x1920 — mismo formato vertical para que
 * la maquetación sea consistente entre canales.
 */
export async function renderStorySticker(
  props: StoryStickerProps,
  options: RenderStoryStickerOptions = {},
): Promise<Buffer> {
  const theme: StoryStickerTheme = options.theme ?? "overlay";
  const fonts = getFonts();
  const res = new ImageResponse(<StorySticker {...props} theme={theme} />, {
    width: 1080,
    height: 1920,
    fonts,
  });
  return Buffer.from(await res.arrayBuffer());
}
