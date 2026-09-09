// =============================================================================
// mi-dorsal — Email: reminder pre-carrera (7 días / 1 día antes)
// =============================================================================
// Mismo lenguaje visual que resultFound.ts (header de marca, hero con
// badge, CTA único, footer) pero sin diploma/PR — solo lo que el corredor
// necesita repasar antes de la salida: fecha, hora, lugar, dorsal (si ya
// está asignado) y su predicción de tiempo.
// =============================================================================

const COLORS = {
  primary: "#dc2626",
  accent: "#16a34a",
  warm: "#fafaf9",
  dark: "#0a0a0a",
  ink: "#1c1917",
  muted: "#78716c",
  subtle: "#a8a29e",
  line: "#e7e5e4",
  card: "#ffffff",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function reminderEmail(args: {
  userName: string;
  raceName: string;
  raceDate: string; // ya formateada, ej "25 de octubre de 2026"
  raceTime?: string; // "HH:MM"
  venue?: string; // lugar de salida o localidad
  distanceLabel?: string; // "10K", "Media maratón", etc.
  dorsalNumber?: string;
  predictedTimeFormatted?: string;
  daysUntil: 7 | 1;
  raceUrl: string; // web oficial / inscripción / ficha de la carrera
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const {
    userName,
    raceName,
    raceDate,
    raceTime,
    venue,
    distanceLabel,
    dorsalNumber,
    predictedTimeFormatted,
    daysUntil,
    raceUrl,
    appUrl,
  } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeRaceDate = escapeHtml(raceDate);
  const safeVenue = venue ? escapeHtml(venue) : null;
  const safeDorsal = dorsalNumber ? escapeHtml(dorsalNumber) : null;
  const safePredicted = predictedTimeFormatted ? escapeHtml(predictedTimeFormatted) : null;

  const isNextDay = daysUntil === 1;

  // ===== Subject / preheader =====
  const subject = isNextDay
    ? `🏁 ¡Es mañana! ${safeRaceName}`
    : `📅 Tu carrera es en 7 días: ${safeRaceName}`;

  const preheader = isNextDay
    ? `Mañana es el día. Todo lo que necesitas saber sobre ${safeRaceName}, dentro.`
    : `Quedan 7 días para ${safeRaceName}. Repasa los detalles antes del gran día.`;

  const badgeText = isNextDay ? "🏁 Es mañana" : "📅 Faltan 7 días";

  // ===== Bloque fecha/hora/lugar =====
  const whenParts = [safeRaceDate, raceTime ? escapeHtml(raceTime) : null].filter(Boolean);
  const whenLine = whenParts.join(" · ");

  // ===== Filas de info (dorsal, predicción) =====
  let infoRows = "";
  if (safeDorsal) {
    infoRows += `
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Tu dorsal</td>
        <td style="padding: 8px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; font-weight: 700;">${safeDorsal}</td>
      </tr>
    `;
  }
  if (safePredicted) {
    infoRows += `
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Tu predicción</td>
        <td style="padding: 8px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; font-weight: 700;">${safePredicted}</td>
      </tr>
    `;
  }
  if (distanceLabel) {
    infoRows += `
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Distancia</td>
        <td style="padding: 8px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; font-weight: 700;">${escapeHtml(distanceLabel)}</td>
      </tr>
    `;
  }

  const infoBlock = infoRows
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; background: ${COLORS.warm}; border-radius: 8px; padding: 4px 16px;">
        ${infoRows}
      </table>
    `
    : "";

  // ===== Tono según proximidad =====
  const bodyCopy = isNextDay
    ? "Deja todo preparado esta noche: dorsal, ropa, desayuno y hora de salida de casa. Mañana solo toca correr."
    : "Todavía tienes margen para el último ajuste: hidratación, sueño y algún rodaje suave. Nada de estrenar zapatillas.";

  // ===== Footer =====
  const footerHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid ${COLORS.line}; padding-top: 20px;">
      <tr>
        <td style="color: ${COLORS.muted}; font-size: 13px; line-height: 1.6;">
          <div>— Manu, en mi-dorsal</div>
          <div style="margin-top: 4px; font-style: italic; color: ${COLORS.subtle};">El hilo que te une a tu dorsal.</div>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 16px;">
          <a href="${appUrl}/perfil" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline; margin-right: 16px;">Tu perfil</a>
          <a href="${appUrl}/calendario" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline; margin-right: 16px;">Calendario</a>
          <a href="${appUrl}/blog" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline;">Historias de dorsal</a>
        </td>
      </tr>
    </table>
  `;

  // ===== HTML =====
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLORS.warm}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${COLORS.ink}; -webkit-font-smoothing: antialiased;">
  <span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(preheader)}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.warm}; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: ${COLORS.card}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);">

          <!-- Brand header -->
          <tr>
            <td style="padding: 16px 28px; border-bottom: 1px solid ${COLORS.line};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: ${COLORS.primary}; border-radius: 6px; vertical-align: middle; margin-right: 8px; line-height: 24px; text-align: center; color: white; font-size: 14px; font-weight: 700;">m</span>
                    <span style="font-size: 15px; font-weight: 600; color: ${COLORS.dark}; vertical-align: middle;">mi-dorsal</span>
                  </td>
                  <td align="right" style="color: ${COLORS.muted}; font-size: 12px; vertical-align: middle;">
                    Recordatorio
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px 28px 16px; text-align: center;">
              <div style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 14px;">
                ${badgeText}
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.dark}; line-height: 1.3;">
                Hola, ${safeUserName}
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">
                <strong>${safeRaceName}</strong>
              </p>
              <div style="margin-top: 6px; color: ${COLORS.muted}; font-size: 14px;">
                ${whenLine}
              </div>
              ${safeVenue ? `<div style="margin-top: 2px; color: ${COLORS.muted}; font-size: 14px;">${safeVenue}</div>` : ""}
            </td>
          </tr>

          <!-- Body copy + info -->
          <tr>
            <td style="padding: 8px 28px 28px;">
              <p style="font-size: 15px; line-height: 1.65; color: ${COLORS.ink}; margin: 0;">
                ${bodyCopy}
              </p>
              ${infoBlock}

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${raceUrl}" style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
                      Ver ficha de la carrera
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 28px 28px;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ===== Plain text =====
  const textLines = [
    `Hola, ${userName}.`,
    "",
    isNextDay ? "Mañana es el día:" : "Faltan 7 días para tu carrera:",
    raceName,
    whenLine.replace(/&amp;/g, "&"),
    venue ?? "",
    "",
    dorsalNumber ? `Tu dorsal: ${dorsalNumber}` : "",
    predictedTimeFormatted ? `Tu predicción: ${predictedTimeFormatted}` : "",
    "",
    bodyCopy,
    "",
    `Ficha de la carrera: ${raceUrl}`,
    "",
    "— Manu, en mi-dorsal",
  ].filter((line) => line !== "");

  const text = textLines.join("\n");

  return { subject, html, text };
}
