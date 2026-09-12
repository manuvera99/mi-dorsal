// =============================================================================
// mi-dorsal — Email: result-found (v2 brand redesign)
// =============================================================================
// Diseño redactado como brader: jerarquía visual con el tiempo como héroe,
// PR como celebración honesta, un solo CTA principal, tono de marca.
// =============================================================================

const COLORS = {
  primary: "#dc2626", // --runner-primary  (rojo asfalto)
  accent: "#16a34a", // --runner-accent   (verde)
  warm: "#fafaf9", // --runner-warm     (crema)
  dark: "#0a0a0a", // --runner-dark     (negro suave)
  ink: "#1c1917",
  muted: "#78716c",
  subtle: "#a8a29e",
  line: "#e7e5e4",
  card: "#ffffff",
  prBg: "#dcfce7", // verde-50, fondo del badge PR
  prText: "#15803d", // verde-700
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  // Nuevos (opcionales, se muestran solo si están):
  isPersonalRecord?: boolean;
  previousRecordFormatted?: string;
  prDeltaSeconds?: number; // mejora en segundos (positivo = bajó)
  distanceLabel?: string; // "5K", "10K", "Media maratón", etc.
  classificationUrl?: string;
  diplomaUrl?: string;
  shareUrl?: string;
  stickerEditorUrl?: string;
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
    isPersonalRecord,
    previousRecordFormatted,
    prDeltaSeconds,
    distanceLabel,
    classificationUrl,
    diplomaUrl,
    shareUrl,
    stickerEditorUrl,
    appUrl,
  } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeTime = escapeHtml(timeFormatted);
  const safeRaceDate = escapeHtml(raceDate);
  const safePrev = previousRecordFormatted ? escapeHtml(previousRecordFormatted) : null;
  const safePred = predictedTimeFormatted ? escapeHtml(predictedTimeFormatted) : null;

  // ===== Subject line (con PR como gancho) =====
  const subject = isPersonalRecord && distanceLabel
    ? `🎉 Nuevo PR en ${distanceLabel} (${safeRaceName}): ${safeTime}`
    : `🏁 ${safeTime} en ${safeRaceName}`;

  // ===== Preheader (preview text en la bandeja) =====
  const preheader = isPersonalRecord && prDeltaSeconds
    ? `Has bajado ${prDeltaSeconds}s en ${escapeHtml(distanceLabel ?? "")}. Tu diploma y clasificación, dentro.`
    : `Tu tiempo oficial, tu diploma y la clasificación completa de ${safeRaceName}.`;

  // ===== Stat blocks (posiciones) =====
  const hasPosGeneral = positionOverall !== undefined && positionOverall !== null;
  const hasPosCat = positionCategory !== undefined && positionCategory !== null;
  const hasPrediction = safePred !== null && errorPct !== undefined;

  const posGeneralText = hasPosGeneral
    ? `<strong>${positionOverall}</strong>${totalRunners ? ` de ${totalRunners}` : ""}`
    : "—";
  const posCatText = hasPosCat
    ? `<strong>${positionCategory}</strong>`
    : "—";

  // ===== Prediction vs reality (tono) =====
  let predictionBlock = "";
  if (hasPrediction) {
    const sign = (errorPct ?? 0) > 0 ? "+" : "";
    const emoji = (errorPct ?? 0) <= 0 ? "🎯" : "⏱️";
    const tone = (errorPct ?? 0) <= 0
      ? "Mejor de lo que pensabas."
      : "Más lento de la estimación.";
    predictionBlock = `
      <tr>
        <td style="padding: 4px 0; color: ${COLORS.muted}; font-size: 14px; vertical-align: top;">Tu estimación</td>
        <td style="padding: 4px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; vertical-align: top;">
          ${safePred} <span style="color: ${COLORS.subtle};">(${sign}${(errorPct ?? 0).toFixed(1)}%)</span>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 6px 0 0; color: ${COLORS.muted}; font-size: 13px; font-style: italic;">
          ${emoji} ${tone}
        </td>
      </tr>
    `;
  }

  // ===== PR badge =====
  let prBadge = "";
  if (isPersonalRecord && safePrev && prDeltaSeconds) {
    prBadge = `
      <div style="margin: 24px auto 0; max-width: 320px; background: ${COLORS.prBg}; border: 1px solid ${COLORS.accent}; border-radius: 999px; padding: 12px 20px; text-align: center;">
        <div style="font-size: 13px; color: ${COLORS.prText}; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
          🎉 Nuevo PR${distanceLabel ? ` en ${escapeHtml(distanceLabel)}` : ""}
        </div>
        <div style="margin-top: 4px; font-size: 14px; color: ${COLORS.dark};">
          Has bajado <strong>${prDeltaSeconds}s</strong> · antes <strong>${safePrev}</strong>
        </div>
      </div>
    `;
  }

  // ===== Diploma button (CTA principal) =====
  const diplomaHref = diplomaUrl ?? `${appUrl}/perfil`;
  const classificationHref = classificationUrl ?? `${appUrl}/carreras`;

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
                    Resultado oficial
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 32px 28px 16px; text-align: center;">
              <div style="display: inline-block; background: ${COLORS.primary}; color: white; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 14px;">
                🏁 ${isPersonalRecord ? "PR personal" : "Cruzaste la meta"}
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.dark}; line-height: 1.3;">
                ${safeRaceName}
              </h1>
              <div style="margin-top: 6px; color: ${COLORS.muted}; font-size: 14px;">
                ${safeRaceDate}
              </div>
            </td>
          </tr>

          <!-- The time (HERO) -->
          <tr>
            <td style="padding: 8px 28px 0; text-align: center;">
              <div style="font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 56px; font-weight: 700; color: ${COLORS.accent}; letter-spacing: -1.5px; line-height: 1;">
                ${safeTime}
              </div>
              <div style="margin-top: 8px; color: ${COLORS.muted}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
                Tu tiempo oficial
              </div>
              ${prBadge}
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 28px 8px;">
              <p style="margin: 0; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">
                Hola <strong>${safeUserName}</strong>, ${isPersonalRecord ? "récord propio." : "lo cruzaste."} Aquí van tus datos.
              </p>
            </td>
          </tr>

          <!-- Stats table -->
          <tr>
            <td style="padding: 12px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.warm}; border-radius: 8px; padding: 16px 18px;">
                <tr>
                  <td style="padding: 4px 0; color: ${COLORS.muted}; font-size: 14px; vertical-align: top;">Posición general</td>
                  <td style="padding: 4px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; vertical-align: top;">${posGeneralText}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: ${COLORS.muted}; font-size: 14px; vertical-align: top;">Posición categoría</td>
                  <td style="padding: 4px 0; color: ${COLORS.ink}; font-size: 14px; text-align: right; vertical-align: top;">${posCatText}</td>
                </tr>
                ${predictionBlock}
              </table>
            </td>
          </tr>

          <!-- Share card visual (inline cid:). Inyectado por
               convex/emailNotificationsAction.sendResultFoundEmail
               reemplazando el marcador SHARE_CARD_INLINE por la imagen
               pre-generada. Si no hay inline, este bloque queda vacío
               (no rompe el email). -->
          <!--SHARE_CARD_INLINE-->

          <!-- CTAs -->
          <tr>
            <td style="padding: 24px 28px 8px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 4px;">
                    <a href="${diplomaHref}" style="display: inline-block; background: ${COLORS.primary}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Ver mi diploma
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px auto 0;">
                <tr>
                  <td style="padding: 0 4px;">
                    <a href="${classificationHref}" style="display: inline-block; color: ${COLORS.primary}; background: white; border: 1px solid ${COLORS.primary}; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                      Clasificación completa
                    </a>
                  </td>
                </tr>
              </table>
              ${shareUrl ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px auto 0;">
                <tr>
                  <td style="padding: 0 4px;">
                    <a href="${escapeHtml(shareUrl)}" style="display: inline-block; color: ${COLORS.muted}; padding: 8px 16px; text-decoration: none; font-size: 13px;">
                      Compartir resultado →
                    </a>
                  </td>
                </tr>
              </table>` : ""}
            </td>
          </tr>

          <!-- Sticker editor teaser: explica el sticker para Stories y -->
          <!-- lleva al editor premium de esa carrera. -->
          ${stickerEditorUrl ? `
          <tr>
            <td style="padding: 8px 28px 8px;">
              <div style="background: ${COLORS.warm}; border-radius: 10px; padding: 18px 20px;">
                <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: ${COLORS.dark};">
                  📱 Tu resultado, listo para tus Stories
                </p>
                <p style="margin: 0 0 14px; font-size: 13px; color: ${COLORS.muted}; line-height: 1.5;">
                  Hemos generado un sticker transparente con tu tiempo, pace y kilómetros, pensado para superponer sobre tu propia foto de carrera en Instagram o TikTok. Personaliza qué datos mostrar y su posición en el editor.
                </p>
                <a href="${escapeHtml(stickerEditorUrl)}" style="display: inline-block; color: ${COLORS.primary}; font-size: 13px; font-weight: 600; text-decoration: none;">
                  Personalizar mi sticker →
                </a>
              </div>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td style="padding: 0 28px 24px;">
              ${footerHtml}
            </td>
          </tr>

        </table>

        <!-- Sub-footer (unsubscribe / legal) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin-top: 16px;">
          <tr>
            <td align="center" style="color: ${COLORS.subtle}; font-size: 11px; line-height: 1.5;">
              Estás recibiendo este email porque te apuntaste a esta carrera en mi-dorsal.<br>
              <a href="${appUrl}/perfil" style="color: ${COLORS.subtle}; text-decoration: underline;">Cambia tus preferencias</a> ·
              <a href="${appUrl}/legal/privacidad" style="color: ${COLORS.subtle}; text-decoration: underline;">Privacidad</a>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  // ===== Plain text fallback =====
  const textLines: string[] = [];
  textLines.push(isPersonalRecord ? `🎉 Nuevo PR${distanceLabel ? ` en ${distanceLabel}` : ""}` : "🏁 ¡Resultado oficial!");
  textLines.push("");
  textLines.push(`${raceName} — ${raceDate}`);
  textLines.push("");
  textLines.push(`Tu tiempo: ${timeFormatted}`);
  if (isPersonalRecord && prDeltaSeconds && previousRecordFormatted) {
    textLines.push(`🎉 Has bajado ${prDeltaSeconds}s (antes ${previousRecordFormatted})`);
  }
  if (positionOverall) {
    textLines.push(`Posición general: ${positionOverall}${totalRunners ? ` de ${totalRunners}` : ""}`);
  }
  if (positionCategory) {
    textLines.push(`Posición categoría: ${positionCategory}`);
  }
  if (predictedTimeFormatted && errorPct !== undefined) {
    const sign = errorPct > 0 ? "+" : "";
    textLines.push(`Estimación: ${predictedTimeFormatted} (${sign}${errorPct.toFixed(1)}%)`);
  }
  textLines.push("");
  textLines.push(`Ver mi diploma: ${diplomaHref}`);
  textLines.push(`Clasificación completa: ${classificationHref}`);
  if (stickerEditorUrl) {
    textLines.push("");
    textLines.push("📱 Tu resultado, listo para tus Stories");
    textLines.push("Hemos generado un sticker transparente con tu tiempo, pace y kilómetros, para superponer sobre tu foto de carrera en Instagram o TikTok. Personalízalo aquí:");
    textLines.push(stickerEditorUrl);
  }
  textLines.push("");
  textLines.push(`— Manu, en mi-dorsal`);
  textLines.push("El hilo que te une a tu dorsal.");
  textLines.push("");
  textLines.push("Cambia tus preferencias: " + `${appUrl}/perfil`);

  return { subject, html, text: textLines.join("\n") };
}

// ============================================================================
// Re-exports del archivo legacy (recordatorio + sin resultado) para no romper
// imports. Se mantienen las versiones anteriores hasta nueva redesign.
// ============================================================================

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

Ver mi calendario: ${appUrl}/calendario
`.trim();

  return { subject, html, text };
}

export function resultNotFoundEmail(args: {
  userName: string;
  raceName: string;
  raceDate: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, raceName, raceDate, appUrl } = args;
  const subject = `⏳ Seguimos buscando tu tiempo en ${raceName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0a0a0a; background: #fafaf9;">
  <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="color: #d97706; margin: 0 0 16px;">⏳ Aún no hemos encontrado tu tiempo</h1>
    <p>Hola <strong>${userName}</strong>,</p>
    <p>Hemos buscado tu dorsal en los resultados de <strong>${raceName}</strong> (${raceDate}) varias veces durante las últimas 48 horas, pero no aparece.</p>
    <p style="color: #6b7280; font-size: 14px;">Esto puede pasar por varias razones:</p>
    <ul style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      <li>La organización aún no ha publicado los resultados definitivos.</li>
      <li>Tu dorsal puede ser incorrecto (verifica en el email de confirmación).</li>
      <li>La carrera cambió de cronometrador y estamos scrapeando la URL equivocada.</li>
    </ul>
    <p>Si te apuntaste con otro dorsal, o si prefieres meterlo a mano, puedes hacerlo aquí:</p>
    <p>
      <a href="${appUrl}/calendario" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Ir a mi calendario
      </a>
    </p>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      Seguiremos buscando durante los próximos días. Si aparece, te avisaremos.
    </p>
    <p style="color: #9ca3af; font-size: 13px; margin-top: 16px;">— mi-dorsal</p>
  </div>
</body>
</html>`.trim();

  const text = `⏳ Aún no hemos encontrado tu tiempo

Hola ${userName},

Hemos buscado tu dorsal en los resultados de ${raceName} (${raceDate}) varias veces durante las últimas 48 horas, pero no aparece.

Esto puede pasar porque:
- La organización aún no ha publicado los resultados definitivos.
- Tu dorsal puede ser incorrecto (verifica en el email de confirmación).
- La carrera cambió de cronometrador.

Si prefieres meterlo a mano: ${appUrl}/calendario

Seguiremos buscando. Si aparece, te avisaremos.

— mi-dorsal`.trim();

  return { subject, html, text };
}
