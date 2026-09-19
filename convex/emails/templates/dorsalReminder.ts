// =============================================================================
// mi-dorsal — Email: dorsal reminder (T-5d)
// =============================================================================
// Recordatorio que se envía 5 días antes de la carrera y cuyo único objetivo
// es empujar al usuario a meter el dorsal en /calendario en cuanto le llegue
// el email de la organización.
//
// Mismo lenguaje visual que reminder.ts (header de marca, hero con badge,
// CTA único, footer) pero con foco en la ACCIÓN (meter dorsal), no en la
// logística de la carrera.
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
  amber: "#f59e0b",
  amberBg: "#fef3c7",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function dorsalReminderEmail(args: {
  userName: string;
  raceName: string;
  raceDate: string; // "25 de octubre de 2026" (locale-aware)
  raceTime?: string;
  venue?: string;
  distanceLabel?: string;
  calendarEditUrl: string; // /calendario?myRaceId=...&edit=dorsal
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const {
    userName,
    raceName,
    raceDate,
    raceTime,
    venue,
    distanceLabel,
    calendarEditUrl,
    appUrl,
  } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeRaceDate = escapeHtml(raceDate);
  const safeRaceTime = raceTime ? escapeHtml(raceTime) : null;
  const safeVenue = venue ? escapeHtml(venue) : null;
  const safeDistance = distanceLabel ? escapeHtml(distanceLabel) : null;

  const whenLine = [safeRaceDate, safeRaceTime].filter(Boolean).join(" · ");

  // ---------------------------------------------------------------------
  // Subject / preheader
  // ---------------------------------------------------------------------
  const subject = `📬 ¿Ya tienes el dorsal de ${raceName}?`;
  const preheader = `Los dorsales suelen llegar entre 3 y 5 días antes. Si te ha llegado, anótalo en tu hilo: ${raceName}.`;

  // ---------------------------------------------------------------------
  // Body copy: explicar el problema + dar el CTA
  // ---------------------------------------------------------------------
  const bodyParagraphs = [
    `Los dorsales de esta carrera suelen asignarse <strong>por el organizador</strong> entre 3 y 5 días antes del día de la prueba, normalmente por email. Revisa tu bandeja de entrada (también <strong>spam</strong> y <strong>promociones</strong>).`,
    `Si ya te ha llegado, anota el número en tu calendario para que el día de la carrera todo fluya — y para que mi-dorsal pueda tener tu dorsal listo para la foto del resultado.`,
  ];

  const bodyCopyHtml = bodyParagraphs
    .map(
      (p) =>
        `<p style="font-size: 15px; line-height: 1.65; color: ${COLORS.ink}; margin: 0 0 14px 0;">${p}</p>`,
    )
    .join("");

  // ---------------------------------------------------------------------
  // Info block (resumen carrera)
  // ---------------------------------------------------------------------
  const infoRows: string[] = [];
  if (safeDistance) {
    infoRows.push(`
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Distancia</td>
        <td style="padding: 8px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; font-weight: 700;">${safeDistance}</td>
      </tr>
    `);
  }
  if (whenLine) {
    infoRows.push(`
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Cuándo</td>
        <td style="padding: 8px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; font-weight: 700;">${whenLine}</td>
      </tr>
    `);
  }
  if (safeVenue) {
    infoRows.push(`
      <tr>
        <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Salida</td>
        <td style="padding: 8px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right;">${safeVenue}</td>
      </tr>
    `);
  }
  // ---- Dorsal: explícitamente "sin asignar" para reforzar el CTA
  infoRows.push(`
    <tr>
      <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 14px;">Tu dorsal</td>
      <td style="padding: 8px 0; color: ${COLORS.amber}; font-size: 14px; text-align: right; font-weight: 700;">
        ⏳ sin asignar
      </td>
    </tr>
  `);

  const infoBlock = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background: ${COLORS.warm}; border-radius: 8px; padding: 4px 16px;">
      ${infoRows.join("")}
    </table>
  `;

  // ---------------------------------------------------------------------
  // CTA simple: botón grande único (no queremos decisión, queremos acción)
  // ---------------------------------------------------------------------
  const ctaHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
      <tr>
        <td align="center">
          <a href="${calendarEditUrl}"
             style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; letter-spacing: 0.2px;">
            Añadir mi dorsal
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 10px;">
          <span style="font-size: 12px; color: ${COLORS.muted};">
            Te llevará a tu calendario con el editor abierto para esa carrera.
          </span>
        </td>
      </tr>
    </table>
  `;

  // ---------------------------------------------------------------------
  // Aviso: si no te llega, no entres en pánico
  // ---------------------------------------------------------------------
  const fallbackNote = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 18px; background: ${COLORS.amberBg}; border-radius: 8px; padding: 12px 16px; border-left: 3px solid ${COLORS.amber};">
      <tr>
        <td style="font-size: 13px; line-height: 1.5; color: ${COLORS.ink};">
          <strong style="color: ${COLORS.amber};">Si todavía no te ha llegado, tranquilo.</strong>
          Hay carreras que lo mandan el mismo día de la prueba, en persona en la Feria del Corredor.
        </td>
      </tr>
    </table>
  `;

  // ---------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------
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
          <a href="${appUrl}/cuenta" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline; margin-right: 16px;">Preferencias de email</a>
          <a href="${appUrl}/blog" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline;">Historias de dorsal</a>
        </td>
      </tr>
    </table>
  `;

  // ---------------------------------------------------------------------
  // HTML final
  // ---------------------------------------------------------------------
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
                    Tu dorsal
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px 28px 16px; text-align: center;">
              <div style="display: inline-block; background: ${COLORS.amber}; color: white; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 14px;">
                📬 ¿Te ha llegado el dorsal?
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.dark}; line-height: 1.3;">
                Hola, ${safeUserName}
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">
                <strong>${safeRaceName}</strong> ${safeDistance ? `<span style="color: ${COLORS.muted}; font-weight: 400;">· ${safeDistance}</span>` : ""}
              </p>
            </td>
          </tr>

          <!-- Body + info + CTA + fallback -->
          <tr>
            <td style="padding: 8px 28px 28px;">
              ${bodyCopyHtml}
              ${infoBlock}
              ${ctaHtml}
              ${fallbackNote}

              <!-- Footer -->
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ---------------------------------------------------------------------
  // Plain text
  // ---------------------------------------------------------------------
  const textLines = [
    `Hola, ${userName}.`,
    "",
    `¿Ya tienes el dorsal de ${raceName}?`,
    `Los dorsales suelen asignarse por el organizador entre 3 y 5 días antes del día de la prueba, normalmente por email.`,
    "Revisa tu bandeja de entrada (también spam y promociones).",
    "",
    `Si ya te ha llegado, anota el número en tu calendario. Si todavía no, tranquilo: hay carreras que los entregan el mismo día de la prueba en la Feria del Corredor.`,
    "",
    distanceLabel ? `Distancia: ${distanceLabel}` : "",
    `Cuándo: ${whenLine.replace(/&amp;/g, "&")}`,
    venue ? `Salida: ${venue}` : "",
    "",
    `Añadir mi dorsal: ${calendarEditUrl}`,
    "",
    "— Manu, en mi-dorsal",
  ].filter((line) => line !== "");

  const text = textLines.join("\n");

  return { subject, html, text };
}