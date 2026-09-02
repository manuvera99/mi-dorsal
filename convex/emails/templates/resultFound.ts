// =============================================================================
// mi-dorsal — Email: result-found
// =============================================================================
// HTML inline para el email de resultado encontrado.
// =============================================================================

export function resultFoundEmail(args: {
  userName: string;
  raceName: string;
  raceDate: string;
  timeFormatted: string;
  positionOverall?: number;
  positionCategory?: number;
  totalRunners?: number;
  predictedTimeFormatted?: string;
  errorPct?: number;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const {
    userName,
    raceName,
    raceDate,
    timeFormatted,
    positionOverall,
    positionCategory,
    totalRunners,
    predictedTimeFormatted,
    errorPct,
    appUrl,
  } = args;

  const subject = `🏁 Tu tiempo en ${raceName}: ${timeFormatted}`;

  const errorText = errorPct !== undefined && predictedTimeFormatted
    ? `<p>Tu estimación era <strong>${predictedTimeFormatted}</strong> (error ${errorPct > 0 ? "+" : ""}${errorPct.toFixed(1)}%).</p>`
    : "";

  const positionText = positionOverall
    ? `<li>Posición general: <strong>${positionOverall}${totalRunners ? ` de ${totalRunners}` : ""}</strong></li>`
    : "";

  const positionCatText = positionCategory
    ? `<li>Posición categoría: <strong>${positionCategory}</strong></li>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0a0a0a; background: #fafaf9;">
  <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="color: #dc2626; margin: 0 0 16px;">🏁 ¡Resultado dentro!</h1>
    <p>Hola <strong>${userName}</strong>,</p>
    <p>Tu resultado oficial en <strong>${raceName}</strong> (${raceDate}):</p>
    <ul style="font-size: 18px; line-height: 1.8;">
      <li>Tiempo: <strong style="color: #16a34a;">${timeFormatted}</strong></li>
      ${positionText}
      ${positionCatText}
    </ul>
    ${errorText}
    <p><a href="${appUrl}/perfil" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Ver mi perfil y diploma</a></p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">— mi-dorsal</p>
  </div>
</body>
</html>`.trim();

  const text = `
🏁 ¡Resultado dentro!

Hola ${userName},

Tu resultado oficial en ${raceName} (${raceDate}):
- Tiempo: ${timeFormatted}
${positionOverall ? `- Posición general: ${positionOverall}${totalRunners ? ` de ${totalRunners}` : ""}` : ""}
${positionCategory ? `- Posición categoría: ${positionCategory}` : ""}

${errorPct !== undefined && predictedTimeFormatted ? `Tu estimación era ${predictedTimeFormatted} (error ${errorPct > 0 ? "+" : ""}${errorPct.toFixed(1)}%).` : ""}

Ver tu perfil y diploma: ${appUrl}/perfil

— mi-dorsal
`.trim();

  return { subject, html, text };
}

export function reminderEmail(args: {
  userName: string;
  raceName: string;
  daysUntil: number;
  dorsalNumber?: string;
  predictedTimeFormatted?: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, raceName, daysUntil, dorsalNumber, predictedTimeFormatted, appUrl } = args;
  const subject = daysUntil === 1
    ? `🔔 Mañana es el día: ${raceName}`
    : `⏰ ${raceName} en ${daysUntil} días`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #fafaf9;">
  <div style="background: white; border-radius: 8px; padding: 24px;">
    <h1 style="color: #dc2626; margin: 0 0 16px;">${daysUntil === 1 ? "🔔" : "⏰"} ${raceName}</h1>
    <p>Hola <strong>${userName}</strong>,</p>
    ${daysUntil === 1
      ? `<p>Mañana es el gran día. Aquí van tus datos:</p>`
      : `<p>Tu carrera es en <strong>${daysUntil} días</strong>.</p>`}
    <ul style="font-size: 16px; line-height: 1.8;">
      ${dorsalNumber ? `<li>Dorsal: <strong>${dorsalNumber}</strong></li>` : ""}
      ${predictedTimeFormatted ? `<li>Estimación: <strong>${predictedTimeFormatted}</strong></li>` : ""}
    </ul>
    <p><a href="${appUrl}/calendario" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Ver mi calendario</a></p>
  </div>
</body>
</html>`.trim();

  const text = `${daysUntil === 1 ? "🔔" : "⏰"} ${raceName}

Hola ${userName},
${daysUntil === 1 ? "Mañana es el gran día. Aquí van tus datos:" : `Tu carrera es en ${daysUntil} días.`}

${dorsalNumber ? `- Dorsal: ${dorsalNumber}` : ""}
${predictedTimeFormatted ? `- Estimación: ${predictedTimeFormatted}` : ""}

Ver tu calendario: ${appUrl}/calendario
`.trim();

  return { subject, html, text };
}
