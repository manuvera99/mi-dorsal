// =============================================================================
// mi-dorsal — Diploma como PNG (preview para email)
// =============================================================================
// Variante del diploma pensada para incrustarse inline en el email de
// resultado. Reutiliza los mismos datos y la misma identidad visual que el
// diploma PDF (lib/pdf/diploma.tsx) pero está implementada con @vercel/og
// (satori) — el mismo motor que ya usa lib/share-card/story-sticker.tsx —
// porque queremos una imagen, no un PDF.
//
// Por qué NO reutilizamos el Diploma de @react-pdf:
//   - @react-pdf no genera PNG. Su árbol de componentes usa StyleSheet/View
//     de pdfkit, no es compatible con satori.
//   - Refactorizar Diploma para que sirva a ambos motores obligaría a
//     mantener un árbol JSX híbrido (satori es más restrictivo que React
//     web, p.ej. no acepta fragmentos en algunos sitios) — más coste que
//     duplicar el layout en un componente específico para la preview.
//
// Por qué tiene sentido duplicar:
//   - El diploma PDF es la pieza "oficial descargable". Se imprime, se
//     comparte como documento, lleva verificaciónId y QR.
//   - La preview PNG es solo una visualización rápida en el email — el
//     usuario sigue teniendo el PDF adjunto y el botón "Ver mi diploma".
//     Si la preview se desactualiza respecto al PDF, no pasa nada: la
//     fuente de verdad sigue siendo el PDF.
//
// Stack: @vercel/og (satori) → JSX → PNG en Node runtime.
// Tokens: mismos que lib/pdf/diploma.tsx y app/globals.css.
// =============================================================================

import * as React from "react";
import { ImageResponse } from "@vercel/og";
import { getFonts } from "../share-card/fonts";

// ---------------------------------------------------------------------------
// Tokens (idénticos a lib/pdf/diploma.tsx y los del email)
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

/**
 * Subset de DiplomaProps que aplica a la preview. Reutiliza exactamente
 * los mismos campos; si el diploma PDF evoluciona, esta preview se queda
 * en sync actualizando ambos componentes a la vez.
 */
export interface DiplomaImageProps {
  runnerName: string;
  raceName: string;
  raceDate: string;
  distanceKm: number;
  distanceLabel: string;
  timeFormatted: string;
  dorsalNumber: string;
  paceFormatted?: string;
  positionOverall?: number;
  totalRunners?: number;
  positionCategory?: number;
  isPersonalRecord?: boolean;
  previousRecordFormatted?: string;
  prDeltaSeconds?: number;
  verificationId: string;
  appUrl: string;
}

// A4 landscape a 96 DPI: 842x595 px. Suficiente para que el texto se
// lea nítido cuando el email cliente lo reduce a 560px de ancho.
const W = 842;
const H = 595;

// ---------------------------------------------------------------------------
// Componente (JSX puro compatible con satori)
// ---------------------------------------------------------------------------

function DiplomaImage(props: DiplomaImageProps) {
  const verificationDomain = props.appUrl.replace(/^https?:\/\//, "");

  return (
    <div
      style={{
        width: `${W}px`,
        height: `${H}px`,
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.warm,
        fontFamily: "Inter",
        padding: "26px",
        position: "relative",
      }}
    >
      {/* Marco decorativo doble (mismo estilo que el diploma PDF) */}
      <div
        style={{
          position: "absolute",
          top: "18px",
          left: "18px",
          right: "18px",
          bottom: "18px",
          border: `1.5px solid ${C.primary}`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "26px",
          left: "26px",
          right: "26px",
          bottom: "26px",
          border: `0.5px solid ${C.primary}`,
          opacity: 0.35,
          display: "flex",
        }}
      />

      {/* Contenedor principal */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "14px",
        }}
      >
        {/* Header: logo + PR badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          {/* Logo textual — el oficial PNG está en public/logo.png pero
              para mantener el bundle ligero y evitar problemas con @vercel/og
              y rutas de filesystem en runtime, usamos wordmark. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "32px",
                height: "32px",
                backgroundColor: C.primary,
                borderRadius: "6px",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "18px",
                fontWeight: 700,
                marginRight: "10px",
              }}
            >
              m
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "20px",
                fontWeight: 700,
                color: C.dark,
                letterSpacing: "-0.3px",
              }}
            >
              mi-dorsal
            </div>
          </div>
          {props.isPersonalRecord && props.distanceLabel ? (
            <div
              style={{
                display: "flex",
                backgroundColor: C.prBg,
                border: `1.5px solid ${C.accent}`,
                borderRadius: "999px",
                padding: "6px 14px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "11px",
                  color: C.prText,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                🎉 NUEVO PR EN {props.distanceLabel.toUpperCase()}
              </div>
            </div>
          ) : null}
        </div>

        {/* Body: dos columnas */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flex: 1,
          }}
        >
          {/* Columna izquierda: dorsal */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "38%",
              alignItems: "center",
              justifyContent: "center",
              paddingRight: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "180px",
                  height: "250px",
                  backgroundColor: C.primary,
                  borderRadius: "10px",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "3px",
                    marginBottom: "6px",
                  }}
                >
                  DORSAL
                </div>
                <div
                  style={{
                    display: "flex",
                    color: "white",
                    fontSize: "92px",
                    fontWeight: 700,
                    letterSpacing: "-3px",
                    lineHeight: 1,
                  }}
                >
                  {props.dorsalNumber}
                </div>
                {/* Distancia: badge redondo abajo-derecha */}
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    bottom: "-16px",
                    right: "-16px",
                    width: "64px",
                    height: "64px",
                    borderRadius: "32px",
                    backgroundColor: "white",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${C.primary}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontWeight: 700,
                      fontSize: "14px",
                      color: C.dark,
                      letterSpacing: "0.3px",
                    }}
                  >
                    {props.distanceLabel.toUpperCase()}
                  </div>
                </div>
              </div>
              {/* Race meta */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginTop: "28px",
                  maxWidth: "260px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: C.dark,
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {props.raceName}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "9px",
                    color: C.muted,
                    marginTop: "6px",
                    letterSpacing: "1.5px",
                  }}
                >
                  {props.raceDate.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha: saludo + tiempo + stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "62%",
              paddingLeft: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "10px",
                color: C.muted,
                letterSpacing: "1.2px",
                marginBottom: "4px",
              }}
            >
              SE OTORGA EL DIPLOMA A
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "22px",
                fontWeight: 700,
                color: C.dark,
                marginBottom: "14px",
                letterSpacing: "-0.2px",
              }}
            >
              {props.runnerName}
            </div>

            {/* Tarjeta tiempo oficial */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "9px",
                  color: C.muted,
                  letterSpacing: "1.5px",
                }}
              >
                TIEMPO OFICIAL
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "36px",
                  fontWeight: 700,
                  color: C.accent,
                  letterSpacing: "-1.2px",
                }}
              >
                {props.timeFormatted}
              </div>
            </div>

            {/* Stats grid 2x2 */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
              }}
            >
              {/* Posición general */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "50%",
                  paddingBottom: "6px",
                  paddingTop: "6px",
                  borderBottom: `0.5px dashed ${C.line}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "8.5px",
                    color: C.muted,
                    letterSpacing: "1px",
                  }}
                >
                  POSICIÓN GENERAL
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: C.dark,
                    marginTop: "2px",
                  }}
                >
                  {props.positionOverall?.toLocaleString("es-ES") ?? "—"}
                  {props.totalRunners ? (
                    <div
                      style={{
                        display: "flex",
                        fontSize: "10px",
                        color: C.muted,
                        marginLeft: "4px",
                      }}
                    >
                      {" / "}
                      {props.totalRunners.toLocaleString("es-ES")}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Posición categoría */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "50%",
                  paddingBottom: "6px",
                  paddingTop: "6px",
                  borderBottom: `0.5px dashed ${C.line}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "8.5px",
                    color: C.muted,
                    letterSpacing: "1px",
                  }}
                >
                  POSICIÓN CATEGORÍA
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: C.dark,
                    marginTop: "2px",
                  }}
                >
                  {props.positionCategory?.toLocaleString("es-ES") ?? "—"}
                </div>
              </div>

              {/* Pace */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "50%",
                  paddingBottom: "6px",
                  paddingTop: "6px",
                  borderBottom: `0.5px dashed ${C.line}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "8.5px",
                    color: C.muted,
                    letterSpacing: "1px",
                  }}
                >
                  PACE MEDIO
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: C.dark,
                    marginTop: "2px",
                  }}
                >
                  {props.paceFormatted ?? "—"}
                  <div
                    style={{
                      display: "flex",
                      fontSize: "10px",
                      color: C.muted,
                      marginLeft: "4px",
                    }}
                  >
                    {" /km"}
                  </div>
                </div>
              </div>

              {/* PR o Distancia */}
              {props.isPersonalRecord &&
              props.prDeltaSeconds &&
              props.previousRecordFormatted ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "50%",
                    paddingBottom: "6px",
                    paddingTop: "6px",
                    borderBottom: `0.5px dashed ${C.line}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: "8.5px",
                      color: C.muted,
                      letterSpacing: "1px",
                    }}
                  >
                    PR EN {props.distanceLabel.toUpperCase()}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: C.dark,
                      marginTop: "2px",
                    }}
                  >
                    {formatDelta(props.prDeltaSeconds)}
                    <div
                      style={{
                        display: "flex",
                        fontSize: "9px",
                        color: C.subtle,
                        textDecoration: "line-through",
                        marginLeft: "4px",
                      }}
                    >
                      {props.previousRecordFormatted}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "50%",
                    paddingBottom: "6px",
                    paddingTop: "6px",
                    borderBottom: `0.5px dashed ${C.line}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: "8.5px",
                      color: C.muted,
                      letterSpacing: "1px",
                    }}
                  >
                    DISTANCIA
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: C.dark,
                      marginTop: "2px",
                    }}
                  >
                    {props.distanceKm.toFixed(1)}
                    <div
                      style={{
                        display: "flex",
                        fontSize: "10px",
                        color: C.muted,
                        marginLeft: "4px",
                      }}
                    >
                      {" km"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${C.line}`,
            paddingTop: "10px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {/* QR placeholder: cuadradito gris donde iría el QR real */}
            <div
              style={{
                display: "flex",
                width: "36px",
                height: "36px",
                backgroundColor: C.line,
                borderRadius: "2px",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "7px",
                  color: C.muted,
                  letterSpacing: "0.5px",
                }}
              >
                QR
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: C.dark,
                }}
              >
                Compartir resultado
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "8px",
                  color: C.muted,
                  marginTop: "1px",
                }}
              >
                Verificable en {verificationDomain}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              textAlign: "right",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "8px",
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              ID <span style={{ fontWeight: 700, color: C.dark }}>
                {props.verificationId}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "8px",
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              mi-dorsal · El hilo que te une a tu dorsal
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formatea delta de PR como "-1:23" (1 minuto 23 segundos menos). */
function formatDelta(seconds: number): string {
  const sign = seconds > 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m === 0) return `${sign}${s}s`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Renderiza el diploma como Buffer PNG (842x595, A4 landscape).
 * Pensado para incrustarse inline en el email de resultado como preview
 * visual. La fuente de verdad oficial sigue siendo el diploma PDF
 * (renderDiploma), que se adjunta al email.
 */
export async function renderDiplomaAsImage(
  props: DiplomaImageProps,
): Promise<Buffer> {
  const fonts = getFonts();
  const res = new ImageResponse(<DiplomaImage {...props} />, {
    width: W,
    height: H,
    fonts,
  });
  return Buffer.from(await res.arrayBuffer());
}
