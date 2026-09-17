/**
 * DiplomaAndSharePreview — sección estrella de la home.
 *
 * v3.1 (sep 2026): restyling visual. Diploma y sticker son **réplicas
 * fieles** de los assets reales que recibe el usuario por email:
 *  - Diploma (PNG preview del email):  lib/pdf/diploma-image.tsx
 *  - Sticker vertical (PNG 1080×1920): lib/share-card/story-sticker.tsx
 *    con theme "email" (fondo crema opaco + paneles blancos).
 *
 * Los mockups son **declarativos** (no fetchean ni renderizan en runtime).
 * El diploma real se sirve desde /api/diploma/[myRaceId]; el sticker se
 * edita/exporta en /editor-sticker/[myRaceId].
 *
 * Se preserva: la lógica de StickerEditorCta (client component) que decide
 * destino según si el usuario es premium.
 *
 * Posición en la home: 2 (justo tras el Hero).
 */

import { StickerEditorCta } from "./sticker-editor-cta";

export function DiplomaAndSharePreview() {
  return (
    <section
      className="py-10 md:py-14"
      aria-labelledby="diploma-title"
      style={{ background: "var(--runner-warm-2, #f5f5f4)" }}
    >
      <div className="text-center mb-8 md:mb-10 max-w-3xl mx-auto px-4">
        <h2
          id="diploma-title"
          className="text-3xl md:text-4xl font-bold"
          style={{
            fontFamily: "var(--font-display, 'Sora', system-ui)",
            color: "#0a0a0a",
            letterSpacing: "-0.015em",
            lineHeight: 1.12,
          }}
        >
          Cuando cruzas la meta, llega a tu buzón.
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto px-4">
        {/* ============================================================
            IZQUIERDA — Diploma (réplica de lib/pdf/diploma-image.tsx)
            ============================================================ */}
        <article aria-label="Diploma PDF A4">
          <div
            className="relative w-full overflow-hidden rounded-2xl border"
            style={{
              aspectRatio: "842 / 595",
              background: "#fafaf9",
              borderColor: "rgba(10,10,10,0.06)",
            }}
            role="img"
            aria-label="Diploma finisher de la Behobia-San Sebastián. Dorsal 2501, tiempo 01:26:14, nuevo PR en 10K."
          >
            {/* Marco decorativo doble */}
            <div
              aria-hidden="true"
              className="absolute"
              style={{
                inset: "3.4%",
                border: "1.5px solid #dc2626",
                borderRadius: "4px",
              }}
            />
            <div
              aria-hidden="true"
              className="absolute"
              style={{
                inset: "4.9%",
                border: "0.5px solid rgba(220,38,38,0.35)",
                borderRadius: "3px",
              }}
            />

            <div
              className="absolute flex flex-col"
              style={{ inset: "6.4%" }}
            >
              {/* Header: brand + PR badge */}
              <header
                className="flex justify-between items-center"
                style={{ marginBottom: "4%" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 22,
                      height: 22,
                      background: "#dc2626",
                      color: "#fff",
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 700,
                      fontSize: "0.65rem",
                      borderRadius: "5px",
                    }}
                  >
                    m
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "clamp(0.7rem, 1.3vw, 0.95rem)",
                      letterSpacing: "-0.3px",
                      color: "#0a0a0a",
                    }}
                  >
                    mi-dorsal
                  </span>
                </div>
                <div
                  style={{
                    background: "#dcfce7",
                    border: "1.5px solid #16a34a",
                    borderRadius: "999px",
                    padding: "0.25rem 0.6rem",
                    fontSize: "clamp(0.45rem, 0.7vw, 0.6rem)",
                    fontWeight: 700,
                    color: "#15803d",
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  🎉 NUEVO PR EN 10K
                </div>
              </header>

              {/* Body: dos columnas */}
              <div className="flex flex-1" style={{ gap: "2.5%" }}>
                {/* Columna izquierda: dorsal rojo */}
                <div
                  className="flex flex-col items-center justify-center"
                  style={{ width: "38%", paddingRight: "2%" }}
                >
                  <div
                    className="relative flex flex-col items-center justify-center"
                    style={{
                      width: "62%",
                      aspectRatio: "180 / 250",
                      background: "#dc2626",
                      borderRadius: "7px",
                      color: "#fff",
                      overflow: "hidden",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "clamp(0.5rem, 0.85vw, 0.7rem)",
                        fontWeight: 700,
                        letterSpacing: "3px",
                        margin: 0,
                      }}
                    >
                      DORSAL
                    </p>
                    <p
                      style={{
                        fontWeight: 800,
                        fontSize: "clamp(1.5rem, 3.6vw, 2.4rem)",
                        letterSpacing: "-0.04em",
                        lineHeight: 1,
                        margin: 0,
                        maxWidth: "88%",
                        textAlign: "center",
                      }}
                    >
                      2501
                    </p>
                    {/* Badge redondo distancia */}
                    <span
                      aria-hidden="true"
                      className="absolute flex items-center justify-center"
                      style={{
                        bottom: "-10%",
                        right: "-10%",
                        width: "26%",
                        aspectRatio: "1",
                        borderRadius: "50%",
                        background: "#fff",
                        color: "#0a0a0a",
                        border: "2px solid #dc2626",
                        fontWeight: 800,
                        fontSize: "clamp(0.5rem, 0.85vw, 0.7rem)",
                      }}
                    >
                      10K
                    </span>
                  </div>

                  {/* Race meta */}
                  <div
                    className="text-center"
                    style={{ marginTop: "8%", maxWidth: "90%" }}
                  >
                    <p
                      style={{
                        fontSize: "clamp(0.65rem, 1vw, 0.85rem)",
                        fontWeight: 700,
                        color: "#0a0a0a",
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      Behobia-San Sebastián
                    </p>
                    <p
                      style={{
                        fontSize: "clamp(0.5rem, 0.7vw, 0.6rem)",
                        color: "#78716c",
                        letterSpacing: "1.5px",
                        margin: "4px 0 0",
                      }}
                    >
                      12 NOV 2026
                    </p>
                  </div>
                </div>

                {/* Columna derecha: saludo + tiempo + stats */}
                <div
                  className="flex flex-col"
                  style={{ width: "62%", paddingLeft: "2.5%" }}
                >
                  <p
                    style={{
                      fontSize: "clamp(0.5rem, 0.8vw, 0.7rem)",
                      color: "#78716c",
                      letterSpacing: "1.2px",
                      margin: 0,
                    }}
                  >
                    SE OTORGA EL DIPLOMA A
                  </p>
                  <p
                    style={{
                      fontSize: "clamp(0.95rem, 1.7vw, 1.45rem)",
                      fontWeight: 700,
                      color: "#0a0a0a",
                      letterSpacing: "-0.2px",
                      margin: "0 0 3.5%",
                      lineHeight: 1.2,
                    }}
                  >
                    Carlos Martínez
                  </p>

                  {/* Time card */}
                  <div
                    className="flex justify-between items-center"
                    style={{
                      background: "#fff",
                      border: "1px solid #e7e5e4",
                      borderRadius: "6px",
                      padding: "3% 5%",
                      marginBottom: "3.5%",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "clamp(0.45rem, 0.7vw, 0.6rem)",
                        color: "#78716c",
                        letterSpacing: "1.5px",
                      }}
                    >
                      TIEMPO OFICIAL
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "clamp(1.2rem, 2.5vw, 2rem)",
                        color: "#16a34a",
                        letterSpacing: "-1.2px",
                        lineHeight: 1,
                      }}
                    >
                      01:26:14
                    </span>
                  </div>

                  {/* Stats grid 2×2 */}
                  <div
                    className="grid grid-cols-2"
                    style={{ gap: "0 3%" }}
                  >
                    <div
                      style={{
                        padding: "2.5% 0",
                        borderBottom: "0.5px dashed #e7e5e4",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "clamp(0.4rem, 0.6vw, 0.55rem)",
                          color: "#78716c",
                          letterSpacing: "1px",
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        POSICIÓN GENERAL
                      </p>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
                          color: "#0a0a0a",
                          margin: "2px 0 0",
                        }}
                      >
                        521<span style={{ fontSize: "clamp(0.5rem, 0.75vw, 0.65rem)", color: "#78716c", fontWeight: 400 }}> / 14.820</span>
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "2.5% 0",
                        borderBottom: "0.5px dashed #e7e5e4",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "clamp(0.4rem, 0.6vw, 0.55rem)",
                          color: "#78716c",
                          letterSpacing: "1px",
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        POSICIÓN CATEGORÍA
                      </p>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
                          color: "#0a0a0a",
                          margin: "2px 0 0",
                        }}
                      >
                        97
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "2.5% 0",
                        borderBottom: "0.5px dashed #e7e5e4",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "clamp(0.4rem, 0.6vw, 0.55rem)",
                          color: "#78716c",
                          letterSpacing: "1px",
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        PACE MEDIO
                      </p>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
                          color: "#0a0a0a",
                          margin: "2px 0 0",
                        }}
                      >
                        4:18<span style={{ fontSize: "clamp(0.5rem, 0.75vw, 0.65rem)", color: "#78716c", fontWeight: 400 }}> /km</span>
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "2.5% 0",
                        borderBottom: "0.5px dashed #e7e5e4",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "clamp(0.4rem, 0.6vw, 0.55rem)",
                          color: "#78716c",
                          letterSpacing: "1px",
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        PR EN 10K
                      </p>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
                          color: "#0a0a0a",
                          margin: "2px 0 0",
                        }}
                      >
                        -5:00
                        <span
                          style={{
                            fontSize: "clamp(0.45rem, 0.65vw, 0.55rem)",
                            color: "#a8a29e",
                            textDecoration: "line-through",
                            marginLeft: "4px",
                            fontWeight: 400,
                          }}
                        >
                          00:48
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* ============================================================
            DERECHA — Sticker (réplica de lib/share-card/story-sticker.tsx,
            theme "email")
            ============================================================ */}
        <article aria-label="Story sticker con el resultado">
          <div
            className="relative w-full max-w-[280px] mx-auto overflow-hidden rounded-2xl border shadow-xl"
            style={{
              aspectRatio: "1080 / 1920",
              background: "#fafaf9",
              borderColor: "rgba(10,10,10,0.06)",
            }}
            role="img"
            aria-label="Sticker 1080x1920 con tiempo oficial 01:26:14, pace 4:18 por kilómetro y 10,0 kilómetros, badge de nuevo PR"
          >
            <div
              className="absolute flex flex-col items-center justify-center"
              style={{
                inset: 0,
                padding: "6%",
                gap: "3.5%",
              }}
            >
              {/* PR badge */}
              <div
                style={{
                  background: "#dcfce7",
                  border: "1.5px solid #16a34a",
                  borderRadius: "999px",
                  padding: "2.5% 5.5%",
                  fontSize: "clamp(0.55rem, 0.95vw, 0.8rem)",
                  fontWeight: 700,
                  color: "#15803d",
                  letterSpacing: "0.5px",
                  whiteSpace: "nowrap",
                }}
              >
                🎉 Nuevo PR
              </div>

              {/* Tiempo hero */}
              <div
                className="flex flex-col items-center text-center"
                style={{
                  width: "88%",
                  background: "#fff",
                  border: "1.5px solid #e7e5e4",
                  borderRadius: "24px",
                  padding: "6% 8%",
                }}
              >
                <p
                  style={{
                    fontSize: "clamp(0.5rem, 0.8vw, 0.65rem)",
                    fontWeight: 700,
                    color: "#0a0a0a",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    margin: "0 0 4%",
                  }}
                >
                  Tu tiempo oficial
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    fontWeight: 700,
                    fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
                    color: "#16a34a",
                    letterSpacing: "-4px",
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  01:26:14
                </p>
              </div>

              {/* Fila pace + km */}
              <div className="flex" style={{ width: "88%", gap: "3%" }}>
                <div
                  className="flex flex-col items-center text-center"
                  style={{
                    flex: 1,
                    background: "#fff",
                    border: "1.5px solid #e7e5e4",
                    borderRadius: "18px",
                    padding: "5% 4%",
                  }}
                >
                  <p
                    style={{
                      fontSize: "clamp(0.4rem, 0.65vw, 0.55rem)",
                      fontWeight: 700,
                      color: "#0a0a0a",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      margin: "0 0 3%",
                    }}
                  >
                    Pace
                  </p>
                  <p
                    className="flex items-baseline"
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontWeight: 700,
                      fontSize: "clamp(0.95rem, 1.6vw, 1.4rem)",
                      color: "#0a0a0a",
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    4:18<span style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.7rem)", marginLeft: "2px" }}>/km</span>
                  </p>
                </div>
                <div
                  className="flex flex-col items-center text-center"
                  style={{
                    flex: 1,
                    background: "#fff",
                    border: "1.5px solid #e7e5e4",
                    borderRadius: "18px",
                    padding: "5% 4%",
                  }}
                >
                  <p
                    style={{
                      fontSize: "clamp(0.4rem, 0.65vw, 0.55rem)",
                      fontWeight: 700,
                      color: "#0a0a0a",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      margin: "0 0 3%",
                    }}
                  >
                    Kilómetros
                  </p>
                  <p
                    className="flex items-baseline"
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontWeight: 700,
                      fontSize: "clamp(0.95rem, 1.6vw, 1.4rem)",
                      color: "#0a0a0a",
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    10,0<span style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.7rem)", marginLeft: "2px" }}>km</span>
                  </p>
                </div>
              </div>

              {/* Brand */}
              <p
                style={{
                  fontSize: "clamp(0.55rem, 0.9vw, 0.75rem)",
                  fontWeight: 700,
                  color: "rgba(10,10,10,0.45)",
                  letterSpacing: "1px",
                  margin: 0,
                }}
              >
                mi-dorsal
              </p>
            </div>
          </div>

          {/* CTA del sticker — componente client que decide destino según Pro */}
          <div className="mt-3 flex items-center justify-between gap-3 text-xs px-1" style={{ color: "#525252" }}>
            <p>Descarga en PNG o mándatelo por email</p>
            <StickerEditorCta className="inline-flex items-center gap-1.5 font-semibold hover:underline text-runner-primary">
              Personalizar el mío
            </StickerEditorCta>
          </div>
        </article>
      </div>

      {/* Cómo llega al buzón — micro-bloque */}
      <div className="max-w-3xl mx-auto mt-8 md:mt-10 px-4">
        <div
          className="rounded-2xl p-4 md:p-5 flex items-start gap-3"
          style={{
            background: "rgba(220,38,38,0.04)",
            border: "1px solid rgba(220,38,38,0.15)",
          }}
        >
          <span
            aria-hidden="true"
            className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-white"
            style={{ width: 40, height: 40, background: "#dc2626" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </span>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: "#1f1f1f" }}>
            <strong style={{ color: "#0a0a0a" }}>Cruzas la meta el domingo.</strong> En cuanto la
            organización publica las clasificaciones, te llega un único email con tu
            tiempo, tu diploma PDF y tu imagen para redes. Sin volver a la web del
            organizador, sin buscar en PDFs indescifrables.
          </p>
        </div>
      </div>
    </section>
  );
}

// Mantener compatibilidad con cualquier import que esperase el nombre antiguo
// (mientras se hace la migración). Se puede borrar en la próxima limpieza.
export const DiplomaPreview = DiplomaAndSharePreview;