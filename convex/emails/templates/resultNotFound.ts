// =============================================================================
// mi-dorsal — Email: result-not-found (48h+ sin resultado scrapeado)
// =============================================================================
// Mismo lenguaje visual que resultFound.ts/reminder.ts, tono honesto y
// sin drama: no encontramos el tiempo, pero el usuario puede metérnoslo
// a mano en /calendario si el cronometrador ya lo publicó, o el link
// directo a la clasificación oficial si lo tenemos.
// =============================================================================

const COLORS = {
  primary: "#dc2626",
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

export function resultNotFoundEmail(args: {
  userName: string;
  raceName: string;
  raceDate: string; // ya formateada, ej "25 de octubre de 2026"
  classificationUrl?: string; // link a la clasificación del cronometrador, si lo tenemos
  calendarUrl: string; // /calendario dentro de mi-dorsal, para meter el tiempo a mano
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, raceName, raceDate, classificationUrl, calendarUrl, appUrl } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeRaceDate = escapeHtml(raceDate);

  const subject = `No encontramos tu tiempo en ${safeRaceName}`;
  const preheader = `Puede que el cronometrador aún no haya publicado la clasificación. Añade tu tiempo a mano si ya lo tienes.`;

  const classificationBlock = classificationUrl
    ? `
      <p style="font-size: 15px; line-height: 1.65; color: ${COLORS.ink}; margin: 16px 0 0;">
        Si el cronometrador ya publicó la clasificación, puedes buscarte aquí:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
        <tr>
          <td align="center">
            <a href="${classificationUrl}" style="display: inline-block; background: ${COLORS.card}; border: 1px solid ${COLORS.line}; color: ${COLORS.ink}; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 8px;">
              Ver clasificación oficial
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

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
                    Tu resultado
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px 28px 16px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: ${COLORS.dark}; line-height: 1.4;">
                Hola, ${safeUserName}. Aún no encontramos tu tiempo.
              </h1>
              <p style="margin: 10px 0 0; font-size: 15px; color: ${COLORS.muted}; line-height: 1.5;">
                <strong>${safeRaceName}</strong> — ${safeRaceDate}
              </p>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding: 8px 28px 28px;">
              <p style="font-size: 15px; line-height: 1.65; color: ${COLORS.ink}; margin: 0;">
                Han pasado más de 48 horas desde la salida y todavía no hemos
                podido leer tu resultado en la fuente oficial. Puede que el
                cronometrador vaya con retraso, o que la clasificación esté
                en un formato que aún no sabemos leer automáticamente.
              </p>
              ${classificationBlock}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td align="center">
                    <a href="${calendarUrl}" style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
                      Añadir mi tiempo a mano
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0; font-size: 13px; color: ${COLORS.subtle}; text-align: center;">
                En cuanto lo metas, generamos tu diploma igual que si lo hubiéramos detectado nosotros.
              </p>
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

  const textLines = [
    `Hola, ${userName}.`,
    "",
    `Aún no encontramos tu tiempo en ${raceName} (${raceDate}).`,
    "",
    "Han pasado más de 48 horas desde la salida y no hemos podido leer tu",
    "resultado en la fuente oficial todavía.",
    "",
    classificationUrl ? `Clasificación oficial: ${classificationUrl}` : "",
    `Añadir tu tiempo a mano: ${calendarUrl}`,
    "",
    "— Manu, en mi-dorsal",
  ].filter((line) => line !== "");

  const text = textLines.join("\n");

  return { subject, html, text };
}
