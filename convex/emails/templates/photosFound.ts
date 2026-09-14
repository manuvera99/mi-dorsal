// =============================================================================
// mi-dorsal — Email: te encontramos en fotos de la carrera
// =============================================================================
// Se envía cuando "Encuentra tus fotos" (photoSearchActions.ts::runJob)
// termina con al menos 1 resultado. A diferencia de photosAvailable (aviso
// genérico de "ya hay álbum"), este email es personal: muestra un preview
// de las fotos concretas donde el usuario apareció.
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

export function photosFoundEmail(args: {
  userName: string;
  raceName: string;
  photoUrls: string[]; // ya recortado a un preview razonable (p.ej. 6)
  totalCount: number; // total real de resultados (puede ser > photoUrls.length)
  resultsUrl: string; // enlace a /perfil/fotos/[raceId] en mi-dorsal
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, raceName, photoUrls, totalCount, resultsUrl, appUrl } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeResultsUrl = escapeHtml(resultsUrl);

  const subject =
    totalCount === 1
      ? `📸 ¡Te encontramos en una foto de ${safeRaceName}!`
      : `📸 ¡Te encontramos en ${totalCount} fotos de ${safeRaceName}!`;
  const preheader = `Ya tenemos tus fotos de ${safeRaceName} — échales un vistazo.`;

  const photoGridRows: string[] = [];
  for (let i = 0; i < photoUrls.length; i += 3) {
    const rowPhotos = photoUrls.slice(i, i + 3);
    const cells = rowPhotos
      .map(
        (url) => `
          <td width="${Math.floor(100 / 3)}%" style="padding: 4px;">
            <a href="${escapeHtml(url)}" style="display: block;">
              <img src="${escapeHtml(url)}" alt="Foto encontrada" width="100%" style="display: block; border-radius: 6px; object-fit: cover; aspect-ratio: 1; background: ${COLORS.line};">
            </a>
          </td>`,
      )
      .join("");
    photoGridRows.push(`<tr>${cells}</tr>`);
  }
  const photoGridHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${photoGridRows.join("")}</table>`;

  const moreText =
    totalCount > photoUrls.length
      ? `<p style="margin: 12px 0 0; font-size: 13px; color: ${COLORS.muted}; text-align: center;">Y ${totalCount - photoUrls.length} más…</p>`
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
          <a href="${appUrl}/calendario" style="color: ${COLORS.muted}; font-size: 12px; text-decoration: underline;">Calendario</a>
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
                    Te encontramos
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px 28px 16px; text-align: center;">
              <div style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 14px;">
                📸 Te encontramos
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.dark}; line-height: 1.3;">
                Hola, ${safeUserName}
              </h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">
                ${totalCount === 1 ? "Te encontramos en una foto" : `Te encontramos en ${totalCount} fotos`} de <strong>${safeRaceName}</strong>
              </p>
            </td>
          </tr>

          <!-- Photo grid -->
          <tr>
            <td style="padding: 8px 28px 8px;">
              ${photoGridHtml}
              ${moreText}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 20px 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${safeResultsUrl}" style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
                      Ver todas mis fotos
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

  const text = [
    `Hola, ${userName}.`,
    "",
    totalCount === 1
      ? `Te encontramos en una foto de ${raceName}.`
      : `Te encontramos en ${totalCount} fotos de ${raceName}.`,
    "",
    `Ver todas tus fotos: ${resultsUrl}`,
    "",
    "— Manu, en mi-dorsal",
  ].join("\n");

  return { subject, html, text };
}
