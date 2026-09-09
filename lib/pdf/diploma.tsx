// =============================================================================
// mi-dorsal — Diploma PDF generator
// =============================================================================
// Genera un diploma PDF oficial de finisher usando @react-pdf/renderer.
// =============================================================================

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
  },
  border: {
    borderWidth: 2,
    borderColor: "#dc2626",
    borderStyle: "solid",
    padding: 40,
  },
  title: {
    fontSize: 48,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: "#78716c",
    textAlign: "center",
    letterSpacing: 3,
    marginTop: 8,
  },
  presented: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 30,
    color: "#78716c",
    letterSpacing: 1,
  },
  name: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 8,
    color: "#0a0a0a",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
    color: "#1c1917",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 40,
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 9,
    color: "#78716c",
    letterSpacing: 1.5,
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    color: "#0a0a0a",
  },
});

export interface DiplomaProps {
  runnerName: string;
  raceName: string;
  raceDate: string;
  distanceKm: number;
  timeFormatted: string;
  positionOverall?: number;
  positionCategory?: number;
  dorsalNumber?: string;
  // Props adicionales para compatibilidad con el diploma v2 (preview
  // oficial con dorsal estilizado, PR badge, verificación). La
  // implementación simple actual no las usa todavía, pero los call sites
  // (app/api/diploma/route.ts, app/api/diploma/[myRaceId]/route.ts,
  // convex/emailNotifications.ts) las pasan. Sin estas el typecheck
  // rompe en build de Vercel.
  // TODO: migrar la implementación del Diploma a la versión v2 completa
  // (commit pendiente que tenía Manu en su working tree).
  distanceLabel?: string;
  timeSeconds?: number;
  paceFormatted?: string;
  totalRunners?: number;
  isPersonalRecord?: boolean;
  previousRecordFormatted?: string;
  prDeltaSeconds?: number;
  verificationId?: string;
  appUrl?: string;
  issuedAt?: Date;
}

export function Diploma(props: DiplomaProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.title}>DIPLOMA</Text>
          <Text style={styles.subtitle}>FINISHER · MI-DORSAL</Text>

          <Text style={styles.presented}>Se otorga el presente diploma a</Text>
          <Text style={styles.name}>{props.runnerName}</Text>

          <Text style={styles.description}>
            Por completar la carrera <Text style={{ fontFamily: "Helvetica-Bold" }}>{props.raceName}</Text>
            {" "}({props.distanceKm.toFixed(1)} km) el {props.raceDate}
            {props.dorsalNumber ? ` con el dorsal ${props.dorsalNumber}` : ""}.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TIEMPO OFICIAL</Text>
              <Text style={styles.statValue}>{props.timeFormatted}</Text>
            </View>
            {props.positionOverall !== undefined && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>POSICIÓN GENERAL</Text>
                <Text style={styles.statValue}>{props.positionOverall}</Text>
              </View>
            )}
            {props.positionCategory !== undefined && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>POSICIÓN CATEGORÍA</Text>
                <Text style={styles.statValue}>{props.positionCategory}</Text>
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderDiploma(props: DiplomaProps): Promise<Buffer> {
  return await renderToBuffer(<Diploma {...props} />);
}
