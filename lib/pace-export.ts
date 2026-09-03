// =============================================================================
// lib/pace-export.ts
// =============================================================================
// Genera archivos descargables para Garmin Connect desde el plan de ritmos
// de la calculadora.
//
// Formatos soportados:
//   - TCX (XML): workout con pace targets por km. Garmin Connect lo importa
//     como entrenamiento estructurado.
//   - CSV: splits universales (km, pace, tiempo acumulado) para Excel o
//     Garmin Connect manual.
//
// NOTA: FIT workout binario es posible con `fit-encoder` pero requiere
// implementar el workout encoder completo (steps + targets). TCX es más
// simple y Garmin lo coge perfectamente.
// =============================================================================

export interface PacePlan {
  /** Nombre del plan (se usa como nombre del workout) */
  name: string;
  /** Distancia total en km */
  distanceKm: number;
  /** Ritmo por km en segundos/km (índice 0 = primer km) */
  paces: number[];
  /** Altitudes por km en metros (opcional, para el altimetry) */
  altitudes?: number[];
  /** Fecha objetivo (opcional, para el workout) */
  targetDate?: string;
}

// =============================================================================
// TCX (Training Center XML) — Garmin Connect lo importa como workout
// =============================================================================

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatPace(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Genera un TCX Workout con un step de 1km por cada pace del plan.
 * Garmin Connect lo importa como entrenamiento estructurado.
 */
export function generateTcx(plan: PacePlan): string {
  const totalSeconds = plan.paces.reduce((sum, p) => sum + p, 0);
  const avgPace = totalSeconds / plan.paces.length;
  const maxPace = Math.max(...plan.paces);
  const minPace = Math.min(...plan.paces);

  const steps = plan.paces
    .map((paceSec, i) => {
      const alt = plan.altitudes?.[i];
      const altStr = alt !== undefined ? ` (+${alt}m)` : "";
      return `      <Step xsi:type="Step_t">
        <StepId>${i + 1}</StepId>
        <Name>Km ${i + 1} - ${formatPace(paceSec)}/km${escapeXml(altStr)}</Name>
        <Duration xsi:type="Distance_t">
          <Meters>1000</Meters>
        </Duration>
        <Target xsi:type="Target_t">
          <Value xsi:type="Pace_t">${paceSec}</Value>
        </Target>
        <Intensity>Active</Intensity>
      </Step>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:tc="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:tp="http://www.garmin.com/xmlschemas/TrainingPlanDatabase/v1">
  <Workouts>
    <Workout Sport="Running">
      <Name>${escapeXml(plan.name)}</Name>
      <Step xsi:type="Step_t">
        <StepId>0</StepId>
        <Name>Calentamiento</Name>
        <Duration xsi:type="Time_t">
          <Seconds>600</Seconds>
        </Duration>
        <Intensity>Warmup</Intensity>
      </Step>
${steps}
      <Step xsi:type="Step_t">
        <StepId>${plan.paces.length + 1}</StepId>
        <Name>Enfriamiento</Name>
        <Duration xsi:type="Time_t">
          <Seconds>300</Seconds>
        </Duration>
        <Intensity>Cooldown</Intensity>
      </Step>
    </Workout>
  </Workouts>
  <Author xsi:type="Application_t">
    <Name>mi-dorsal</Name>
    <Build>
      <Version>
        <VersionMajor>1</VersionMajor>
        <VersionMinor>0</VersionMinor>
      </Version>
    </Build>
    <LangID>es</LangID>
    <PartNumber>000-00000-00</PartNumber>
  </Author>
</TrainingCenterDatabase>
`;
}

// =============================================================================
// CSV — splits universales
// =============================================================================

/**
 * Genera un CSV con los splits del plan. Formato Garmin Connect-friendly.
 *
 * Columnas:
 *   - km: número de km
 *   - pace_min_km: pace en formato mm:ss
 *   - pace_seconds: pace en segundos (para Excel)
 *   - split_time: tiempo acumulado en formato hh:mm:ss
 *   - split_seconds: tiempo acumulado en segundos
 *   - altitude_m: altitud en metros (si hay altimetría)
 *   - speed_kmh: velocidad en km/h
 */
export function generateCsv(plan: PacePlan): string {
  let cumulative = 0;
  const rows: string[] = [
    "km,pace_min_km,pace_seconds,split_time,split_seconds,altitude_m,speed_kmh",
  ];
  plan.paces.forEach((paceSec, i) => {
    cumulative += paceSec;
    const alt = plan.altitudes?.[i] ?? "";
    const speed = (3600 / paceSec).toFixed(2);
    rows.push(
      [
        i + 1,
        formatPace(paceSec),
        Math.round(paceSec),
        formatTime(cumulative),
        Math.round(cumulative),
        alt,
        speed,
      ].join(","),
    );
  });
  return rows.join("\n") + "\n";
}

// =============================================================================
// Helper de descarga en el browser
// =============================================================================

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTcx(plan: PacePlan): void {
  const tcx = generateTcx(plan);
  const safeName = plan.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  downloadFile(`mi-dorsal-${safeName}.tcx`, tcx, "application/xml");
}

export function downloadCsv(plan: PacePlan): void {
  const csv = generateCsv(plan);
  const safeName = plan.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  downloadFile(`mi-dorsal-${safeName}.csv`, csv, "text/csv");
}

// =============================================================================
// Stats del plan (útil para el componente)
// =============================================================================

export interface PlanStats {
  totalSeconds: number;
  avgPace: number;
  fastestKm: number;
  slowestKm: number;
  totalDistance: number;
}

export function computePlanStats(plan: PacePlan): PlanStats {
  const totalSeconds = plan.paces.reduce((sum, p) => sum + p, 0);
  return {
    totalSeconds,
    avgPace: totalSeconds / plan.paces.length,
    fastestKm: Math.min(...plan.paces),
    slowestKm: Math.max(...plan.paces),
    totalDistance: plan.paces.length,
  };
}
