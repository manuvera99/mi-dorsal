// =============================================================================
// mi-dorsal — Share card PNG (1200x630, OG image)
// =============================================================================
// Renderiza el visual estilo "Strava" del resultado oficial: dorsal grande,
// tiempo como héroe, stats clave. Pensado para:
//   1. Adjuntar inline en el email de resultado_found (cid:)
//   2. Servir como og:image al compartir la URL pública del resultado
//   3. Descargable desde la página de perfil como PNG
//
// Stack: @vercel/og (satori) → JSX → PNG en Node runtime.
// Mismas convenciones de tokens que lib/pdf/diploma.tsx y app/globals.css.
// =============================================================================

import { ImageResponse } from "@vercel/og";

// ---------------------------------------------------------------------------
// Tokens (alineados con diploma.tsx y app/globals.css)
// ---------------------------------------------------------------------------

const C = {
  primary: "#dc2626",
  primaryDark: "#b91c1c",
  accent: "#16a34a",
  warm: "#fafaf9",
  dark: "#0a0a0a",
  ink: "#1c1917",
  muted: "#78716c",
  subtle: "#a8a29e",
  line: "#e7e5e4",
  card: "#ffffff",
  prBg: "#dcfce7",
  prText: "#15803d",
} as const;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface ShareCardProps {
  runnerName: string;
  raceName: string;
  raceDate: string; // ya formateada, ej "25 de octubre de 2025"
  distanceLabel?: string; // "5K", "10K", "Media maratón" — opcional para tolerar DiplomaProps v2 simple
  timeFormatted?: string; // "1:59:25" — opcional, se calcula desde timeSeconds si falta
  dorsalNumber?: string;
  positionOverall?: number;
  totalRunners?: number;
  positionCategory?: number;
  paceFormatted?: string;
  isPersonalRecord?: boolean;
  previousRecordFormatted?: string;
  prDeltaSeconds?: number;
  timeSeconds?: number;
  appUrl?: string; // "https://mi-dorsal.com" → se muestra como "mi-dorsal.com"
}

// ---------------------------------------------------------------------------
// Carga de fuentes (Inter + JetBrains Mono desde Google Fonts CDN)
// ---------------------------------------------------------------------------

let _fontsCache: Awaited<ReturnType<typeof loadFonts>> | null = null;

async function loadFonts() {
  // Inter (UI) y JetBrains Mono (dorsal + tiempo)
  // satori no soporta woff2 directamente — descargamos el TTF original.
  // Fuentes de Google Fonts CDN (URLs oficiales de los TTF).
  const [interRegular, interBold, jetRegular, jetBold] = await Promise.all([
    fetch(
      "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf",
    ).then((r) => r.arrayBuffer()),
    fetch(
      "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf",
    ).then((r) => r.arrayBuffer()),
    fetch(
      "https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Regular.ttf",
    ).then((r) => r.arrayBuffer()),
    fetch(
      "https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf",
    ).then((r) => r.arrayBuffer()),
  ]);

  return [
    { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: jetRegular, weight: 400 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: jetBold, weight: 700 as const, style: "normal" as const },
  ];
}

async function getFonts() {
  if (_fontsCache) return _fontsCache;
  _fontsCache = await loadFonts();
  return _fontsCache;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDelta(seconds: number): string {
  const sign = seconds > 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m === 0) return `${sign}${s}s`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Componente (JSX puro compatible con satori)
// ---------------------------------------------------------------------------

function ShareCard(props: ShareCardProps) {
  const isPR = !!props.isPersonalRecord && !!props.prDeltaSeconds && !!props.previousRecordFormatted;
  const domain = (props.appUrl ?? "mi-dorsal.com").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "row",
        backgroundColor: C.warm,
        fontFamily: "Inter",
        color: C.ink,
        position: "relative",
      }}
    >
      {/* ====== Columna izquierda: dorsal estilizado (40%) ====== */}
      <div
        style={{
          width: "480px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
          backgroundColor: C.warm,
        }}
      >
        {/* Dorsal card (rojo) */}
        <div
          style={{
            width: "320px",
            height: "440px",
            backgroundColor: C.primary,
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            padding: "32px",
          }}
        >
          {/* DORSAL label */}
          <div
            style={{
              color: "white",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "8px",
              marginBottom: "16px",
            }}
          >
            DORSAL
          </div>
          {/* Dorsal number (gigante) */}
          <div
            style={{
              color: "white",
              fontSize: "180px",
              fontWeight: 700,
              fontFamily: "JetBrains Mono",
              letterSpacing: "-8px",
              lineHeight: 1,
            }}
          >
            {props.dorsalNumber}
          </div>
          {/* Distance pill (esquina inferior derecha) */}
          <div
            style={{
              position: "absolute",
              bottom: "-24px",
              right: "-24px",
              width: "112px",
              height: "112px",
              borderRadius: "56px",
              backgroundColor: "white",
              borderWidth: "4px",
              borderStyle: "solid",
              borderColor: C.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: "26px",
                fontWeight: 700,
                color: C.dark,
                letterSpacing: "0.5px",
                fontFamily: "JetBrains Mono",
              }}
            >
              {(props.distanceLabel ?? "—").toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* ====== Columna derecha: datos (60%) ====== */}
      <div
        style={{
          width: "720px",
          display: "flex",
          flexDirection: "column",
          padding: "48px 56px 40px 32px",
          backgroundColor: C.warm,
          position: "relative",
        }}
      >
        {/* Brand header */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {/* Mini-logo cuadrado */}
            <div
              style={{
                width: "32px",
                height: "32px",
                backgroundColor: C.primary,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "10px",
              }}
            >
              <div
                style={{
                  color: "white",
                  fontSize: "20px",
                  fontWeight: 700,
                  fontFamily: "JetBrains Mono",
                  lineHeight: 1,
                }}
              >
                m
              </div>
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: C.dark,
                letterSpacing: "-0.3px",
              }}
            >
              mi-dorsal
            </div>
          </div>
          <div
            style={{
              fontSize: "13px",
              color: C.muted,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            Resultado oficial
          </div>
        </div>

        {/* PR badge (si aplica) */}
        {isPR ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              backgroundColor: C.prBg,
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: C.accent,
              borderRadius: "999px",
              padding: "8px 18px",
              marginBottom: "16px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: C.prText,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              Nuevo PR en {props.distanceLabel ?? ""}
            </div>
          </div>
        ) : null}

        {/* Race name */}
        <div
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: C.dark,
            lineHeight: 1.2,
            marginBottom: "8px",
            display: "flex",
          }}
        >
          {props.raceName}
        </div>
        <div
          style={{
            fontSize: "16px",
            color: C.muted,
            marginBottom: "24px",
            letterSpacing: "0.5px",
          }}
        >
          {props.raceDate}
        </div>

        {/* HÉROE: tiempo oficial */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              fontSize: "104px",
              fontWeight: 700,
              fontFamily: "JetBrains Mono",
              color: C.accent,
              letterSpacing: "-4px",
              lineHeight: 1,
            }}
          >
            {props.timeFormatted ?? "—"}
          </div>
        </div>
        <div
          style={{
            fontSize: "13px",
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "2px",
            marginBottom: "20px",
          }}
        >
          Tu tiempo oficial
        </div>

        {/* Stats row (3 columnas) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            marginBottom: "auto",
          }}
        >
          {/* Posición general */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: C.line,
              borderRadius: "10px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: C.muted,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Pos. general
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: C.dark,
                display: "flex",
              }}
            >
              {props.positionOverall?.toLocaleString("es-ES") ?? "—"}
              {props.totalRunners ? (
                <div
                  style={{
                    fontSize: "14px",
                    color: C.muted,
                    marginLeft: "4px",
                    alignSelf: "flex-end",
                    paddingBottom: "2px",
                  }}
                >
                  / {props.totalRunners.toLocaleString("es-ES")}
                </div>
              ) : null}
            </div>
          </div>

          {/* Posición categoría */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: C.line,
              borderRadius: "10px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: C.muted,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Pos. categoría
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: C.dark,
                display: "flex",
              }}
            >
              {props.positionCategory?.toLocaleString("es-ES") ?? "—"}
            </div>
          </div>

          {/* Pace */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: C.line,
              borderRadius: "10px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: C.muted,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Pace medio
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                fontFamily: "JetBrains Mono",
                color: C.dark,
                display: "flex",
                alignItems: "baseline",
              }}
            >
              {props.paceFormatted ?? "—"}
              <div
                style={{
                  fontSize: "13px",
                  color: C.muted,
                  marginLeft: "4px",
                }}
              >
                /km
              </div>
            </div>
          </div>
        </div>

        {/* Footer: tagline + URL verificable */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "24px",
            paddingTop: "16px",
            borderTopWidth: "1px",
            borderTopStyle: "solid",
            borderTopColor: C.line,
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: C.muted,
              fontStyle: "italic",
            }}
          >
            El hilo que te une a tu dorsal
          </div>
          <div
            style={{
              fontSize: "13px",
              color: C.subtle,
              display: "flex",
            }}
          >
            {domain}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Renderiza el share card como Buffer PNG.
 * Pensado para:
 *   - Subir a Convex Storage y adjuntar al email (cid: inline)
 *   - Servir desde una API route con cache-control
 */
export async function renderShareCard(props: ShareCardProps): Promise<Buffer> {
  const fonts = await getFonts();
  const res = new ImageResponse(<ShareCard {...props} />, {
    width: 1200,
    height: 630,
    fonts,
  });
  // ImageResponse es Response-like (no Promise) → no se puede encadenar
  // .then(). Usamos arrayBuffer() directamente.
  return Buffer.from(await res.arrayBuffer());
}
