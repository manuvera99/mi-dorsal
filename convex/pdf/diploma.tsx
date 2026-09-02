// =============================================================================
// mi-dorsal — Diploma PDF generator
// =============================================================================
// Genera un diploma PDF usando @react-pdf/renderer.
// =============================================================================

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 60,
    backgroundColor: "#fafaf9",
    fontFamily: "Helvetica",
  },
  border: {
    border: "3px solid #dc2626",
    padding: 40,
    height: "100%",
  },
  title: {
    fontSize: 42,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "Helvetica-Bold",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 40,
    letterSpacing: 4,
  },
  presented: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 8,
  },
  name: {
    fontSize: 32,
    color: "#0a0a0a",
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "Helvetica-Bold",
  },
  description: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 1.6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 30,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 9,
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    color: "#0a0a0a",
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#9ca3af",
  },
  brand: {
    fontSize: 10,
    color: "#dc2626",
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
});

interface DiplomaProps {
  runnerName: string;
  raceName: string;
  raceDate: string;
  distanceKm: number;
  timeFormatted: string;
  positionOverall?: number;
  positionCategory?: number;
  dorsalNumber?: string;
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
                <Text style={styles.statValue}>#{props.positionOverall}</Text>
              </View>
            )}
            {props.positionCategory !== undefined && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>POSICIÓN CATEGORÍA</Text>
                <Text style={styles.statValue}>#{props.positionCategory}</Text>
              </View>
            )}
          </View>

          <Text style={styles.footer}>
            {new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <Text style={styles.brand}>mi-dorsal · El hilo que te une a tu dorsal</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderDiploma(props: DiplomaProps): Promise<Buffer> {
  return await renderToBuffer(<Diploma {...props} />);
}
