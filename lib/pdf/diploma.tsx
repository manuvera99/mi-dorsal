// =============================================================================
// mi-dorsal — Diploma PDF generator
// =============================================================================
// Genera un diploma PDF oficial de finisher usando @react-pdf/renderer.
//
// Diseño v2 (sept 2026):
//   - Logo horizontal oficial de mi-dorsal (public/logo.png)
//   - Dorsal estilizado grande (protagonista visual)
//   - Tiempo oficial como héroe (verde accent)
//   - PR badge si hay récord personal
//   - Marco decorativo (no borde sólido de los 90)
//   - QR placeholder + ID verificable
//
// Output: Buffer (PDF) listo para:
//   - Adjuntar al email de resultado oficial
//   - Guardar en Convex Storage
//   - Servir desde una API route
// =============================================================================

import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Fuentes: registramos Inter (métrica-compatible con Helvetica) como
// "Helvetica" / "Helvetica-Bold" para que los estilos existentes sigan
// funcionando sin tocar nombres. Esto evita el bug de @react-pdf en
// Vercel Lambda donde pdfkit no encuentra las fuentes estándar en el
// filesystem del Lambda.
// ---------------------------------------------------------------------------

(function registerFonts() {
  const fontsDir = join(process.cwd(), "lib", "pdf", "fonts");
  const regPath = join(fontsDir, "Inter-Regular.ttf");
  const boldPath = join(fontsDir, "Inter-Bold.ttf");
  const regB64 = readFileSync(regPath).toString("base64");
  const boldB64 = readFileSync(boldPath).toString("base64");
  Font.register({
    family: "Helvetica",
    fonts: [
      { src: `data:font/ttf;base64,${regB64}`, fontWeight: "normal" },
      { src: `data:font/ttf;base64,${boldB64}`, fontWeight: "bold" },
    ],
  });
  // Re-registramos "Helvetica-Bold" como family para que `fontFamily: "Helvetica-Bold"`
  // siga funcionando en los StyleSheet.
  Font.register({
    family: "Helvetica-Bold",
    src: `data:font/ttf;base64,${boldB64}`,
  });
})();

// ---------------------------------------------------------------------------
// Assets: cargamos el logo como base64 para que funcione en cualquier
// entorno (Next.js server, Convex action, scripts locales).
// En runtime, se cachea en module scope para no releer el disco cada vez.
// ---------------------------------------------------------------------------

let _logoBase64: string | null = null;
function getLogoBase64(): string {
  if (_logoBase64) return _logoBase64;
  const logoPath = join(process.cwd(), "public", "logo.png");
  const buf = readFileSync(logoPath);
  _logoBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  return _logoBase64;
}

// ---------------------------------------------------------------------------
// Tokens (alineados con app/globals.css y tailwind.config.ts)
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
};

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.warm,
    padding: 0,
    fontFamily: "Helvetica",
  },
  // Marco decorativo doble (no borde sólido)
  borderOuter: {
    position: "absolute",
    top: 18, left: 18, right: 18, bottom: 18,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderStyle: "solid",
  },
  borderInner: {
    position: "absolute",
    top: 26, left: 26, right: 26, bottom: 26,
    borderWidth: 0.5,
    borderColor: C.primary,
    borderStyle: "solid",
    opacity: 0.35,
  },
  // Contenedor principal
  container: {
    position: "absolute",
    top: 40, left: 40, right: 40, bottom: 40,
    flexDirection: "column",
  },
  // ====== Header ======
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    height: 48,
    objectFit: "contain",
  },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.prBg,
    borderWidth: 1.5,
    borderColor: C.accent,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  prBadgeText: {
    color: C.prText,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  // ====== Body: dos columnas ======
  body: {
    flex: 1,
    flexDirection: "row",
  },
  leftCol: {
    width: "38%",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 16,
  },
  rightCol: {
    width: "62%",
    paddingLeft: 16,
  },
  // Dorsal
  dorsalWrap: {
    alignItems: "center",
  },
  dorsalCard: {
    width: 180,
    height: 250,
    backgroundColor: C.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dorsalLabel: {
    color: "white",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    marginBottom: 6,
  },
  dorsalNumber: {
    color: "white",
    fontSize: 92,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -3,
    lineHeight: 1,
  },
  dorsalDistance: {
    position: "absolute",
    bottom: -16,
    right: -16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.primary,
  },
  dorsalDistanceText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: C.dark,
    letterSpacing: 0.3,
  },
  raceMeta: {
    marginTop: 28,
    alignItems: "center",
    maxWidth: 260,
  },
  raceName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
    textAlign: "center",
    lineHeight: 1.3,
  },
  raceWhen: {
    fontSize: 9,
    color: C.muted,
    marginTop: 6,
    letterSpacing: 1.5,
  },
  // Stats
  greet: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  runnerName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  timeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  timeLabel: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1.5,
  },
  timeValue: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    letterSpacing: -1.2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  stat: {
    width: "50%",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    borderBottomStyle: "dashed",
  },
  statLabel: {
    fontSize: 8.5,
    color: C.muted,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
    marginTop: 2,
  },
  statValueSub: {
    fontSize: 10,
    color: C.muted,
    fontFamily: "Helvetica",
  },
  statPrev: {
    fontSize: 9,
    color: C.subtle,
    textDecoration: "line-through",
    marginLeft: 4,
    fontFamily: "Helvetica",
  },
  // ====== Footer ======
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    borderTopStyle: "solid",
    paddingTop: 10,
    marginTop: 12,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  qr: {
    width: 36,
    height: 36,
    backgroundColor: C.dark,
  },
  qrTextWrap: {
    marginLeft: 10,
  },
  qrTextTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
  },
  qrTextSub: {
    fontSize: 8,
    color: C.muted,
    marginTop: 1,
  },
  footerRight: {
    textAlign: "right",
  },
  footerLine: {
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.5,
  },
  footerLineStrong: {
    fontFamily: "Helvetica-Bold",
    color: C.dark,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formatea segundos como HH:MM:SS (sin días). */
function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Formatea pace como M:SS /km. */
function formatPace(timeSeconds: number, distanceKm: number): string {
  if (distanceKm <= 0) return "—";
  const paceSec = timeSeconds / distanceKm;
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
// Props
// ---------------------------------------------------------------------------

export interface DiplomaProps {
  runnerName: string;
  raceName: string;
  raceDate: string;
  distanceKm: number;
  distanceLabel: string;
  timeFormatted: string;
  timeSeconds?: number;
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
  issuedAt?: Date;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function Diploma(props: DiplomaProps) {
  const timeFormatted = props.timeFormatted
    || (props.timeSeconds ? formatHMS(props.timeSeconds) : "—");
  const paceFormatted = props.paceFormatted
    || (props.timeSeconds && props.distanceKm ? formatPace(props.timeSeconds, props.distanceKm) : "—");
  const issuedAt = props.issuedAt ?? new Date();
  const issuedAtFormatted = issuedAt.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.borderOuter} fixed />
        <View style={styles.borderInner} fixed />

        <View style={styles.container}>
          <View style={styles.header}>
            <Image src={getLogoBase64()} style={styles.logo} />
            {props.isPersonalRecord && props.distanceLabel && (
              <View style={styles.prBadge}>
                <Text style={styles.prBadgeText}>NUEVO PR EN {props.distanceLabel.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={styles.body}>
            <View style={styles.leftCol}>
              <View style={styles.dorsalWrap}>
                <View style={styles.dorsalCard}>
                  <Text style={styles.dorsalLabel}>DORSAL</Text>
                  <Text style={styles.dorsalNumber}>{props.dorsalNumber}</Text>
                  <View style={styles.dorsalDistance}>
                    <Text style={styles.dorsalDistanceText}>{props.distanceLabel.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.raceMeta}>
                  <Text style={styles.raceName}>{props.raceName}</Text>
                  <Text style={styles.raceWhen}>{props.raceDate.toUpperCase()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.rightCol}>
              <Text style={styles.greet}>SE OTORGA EL DIPLOMA A</Text>
              <Text style={styles.runnerName}>{props.runnerName}</Text>

              <View style={styles.timeCard}>
                <Text style={styles.timeLabel}>TIEMPO OFICIAL</Text>
                <Text style={styles.timeValue}>{timeFormatted}</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>POSICIÓN GENERAL</Text>
                  <Text style={styles.statValue}>
                    {props.positionOverall?.toLocaleString("es-ES") ?? "—"}
                    {props.totalRunners ? (
                      <Text style={styles.statValueSub}>
                        {" / "}{props.totalRunners.toLocaleString("es-ES")}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>POSICIÓN CATEGORÍA</Text>
                  <Text style={styles.statValue}>
                    {props.positionCategory?.toLocaleString("es-ES") ?? "—"}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>PACE MEDIO</Text>
                  <Text style={styles.statValue}>
                    {paceFormatted}
                    <Text style={styles.statValueSub}> {" /km"}</Text>
                  </Text>
                </View>
                {props.isPersonalRecord && props.prDeltaSeconds && props.previousRecordFormatted ? (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>
                      PR EN {props.distanceLabel.toUpperCase()}
                    </Text>
                    <Text style={styles.statValue}>
                      {formatDelta(props.prDeltaSeconds)}
                      <Text style={styles.statPrev}>
                        {props.previousRecordFormatted}
                      </Text>
                    </Text>
                  </View>
                ) : (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>DISTANCIA</Text>
                    <Text style={styles.statValue}>
                      {props.distanceKm.toFixed(1)}
                      <Text style={styles.statValueSub}> {" km"}</Text>
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <View style={styles.qr} />
              <View style={styles.qrTextWrap}>
                <Text style={styles.qrTextTitle}>Compartir resultado</Text>
                <Text style={styles.qrTextSub}>
                  Verificable en {props.appUrl.replace(/^https?:\/\//, "")}
                </Text>
              </View>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerLine}>
                ID <Text style={styles.footerLineStrong}>{props.verificationId}</Text>
              </Text>
              <Text style={styles.footerLine}>
                Emitido el {issuedAtFormatted}
              </Text>
              <Text style={styles.footerLine}>
                mi-dorsal · El hilo que te une a tu dorsal
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Genera el diploma como Buffer PDF.
 * Útil para:
 *   - Adjuntar al email de resultado oficial
 *   - Servir desde una API route
 *   - Guardar en Convex Storage
 */
export async function renderDiploma(props: DiplomaProps): Promise<Buffer> {
  return await renderToBuffer(<Diploma {...props} />);
}
