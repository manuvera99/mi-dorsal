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

/**
 * Bandas de coherencia horaria para los recordatorios.
 *
 * Antes el sistema tenía solo 2 modos (1d / 7d) con copy estático. El problema
 * que destapó el bug del 26 sep: a las 16:00 con la carrera a las 22:30 el copy
 * decía "cena temprano y a la cama" — un disparate si faltan 6h y la salida es
 * por la noche. Ahora hay 5 bandas finas según hoursUntilRace:
 *
 *   runningNow   <1h    estás saliendo ya
 *   hoursAway    1-6h   tienes tiempo de cenar ligero antes
 *   eveningBefore 6-18h la carrera es esta tarde/noche
 *   tomorrow     18-48h es mañana
 *   daysAhead    48h+   quedan días
 *
 * Cada banda tiene copy coherente con la hora real y siempre incluye la hora
 * de salida y la fecha relativa ("hoy 22:30", "mañana 10:00", "el domingo 4 oct
 * 09:30") para que el corredor haga la cuenta mental sin dudar.
 */
export type ReminderUrgency =
  | "runningNow"
  | "hoursAway"
  | "eveningBefore"
  | "tomorrow"
  | "daysAhead";

export function reminderUrgencyFromHours(hoursUntilRace: number): ReminderUrgency {
  if (hoursUntilRace < 1) return "runningNow";
  if (hoursUntilRace < 6) return "hoursAway";
  // eveningBefore cubre el rango en el que "cena ligera esta noche" tiene
  // sentido: la carrera es hoy por la tarde/noche y aún no es hora de
  // dormir. Por eso va hasta <24h (no 18h). Si quedan 24h+, ya es mañana
  // para el corredor y recomendar cenar ligero esta noche no tiene sentido
  // (puede haber cenado a las 22h del día anterior).
  if (hoursUntilRace < 24) return "eveningBefore";
  if (hoursUntilRace < 72) return "tomorrow";
  return "daysAhead";
}

/**
 * Formatea la referencia temporal humana que se muestra en el email
 * ("hoy 22:30", "mañana 10:00", "el domingo 4 oct 09:30"). Usa el
 * timezone Europe/Madrid (sprint de la app). Si no se pasa hoursUntilRace,
 * devuelve solo la fecha.
 *
 * @param hoursUntilRace horas hasta la salida, en el momento de envío
 * @param raceTime hora de salida en formato HH:MM (Europe/Madrid)
 * @param raceDate fecha de salida ya formateada (es-ES long)
 */
export function formatRaceWhenRelative(
  hoursUntilRace: number,
  raceTime: string | undefined,
  raceDate: string,
): string {
  const timeSuffix = raceTime ? ` a las ${raceTime}` : "";
  if (hoursUntilRace < 24) {
    // Carrera es HOY
    return `hoy${timeSuffix}`;
  }
  if (hoursUntilRace < 48) {
    // Mañana
    return `mañana${timeSuffix}`;
  }
  if (hoursUntilRace < 72) {
    // Pasado mañana
    return `pasado mañana${timeSuffix}`;
  }
  // 3 días o más: usar la fecha completa formateada.
  // raceDate ya viene en es-ES long ("sábado, 26 de septiembre") — devolvemos
  // eso + la hora si la tenemos.
  return raceTime ? `el ${raceDate} a las ${raceTime}` : `el ${raceDate}`;
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
  /**
   * Tono del recordatorio. Si se omite, se deriva de daysUntil (legacy).
   * Cron calcula urgency desde hoursUntilRace — es lo recomendado.
   */
  urgency?: ReminderUrgency;
  daysUntil?: 7 | 1; // legacy
  /**
   * Horas hasta la salida en el momento del envío. Necesario para que el
   * copy sea coherente con la hora real (badge, body, línea 'tu carrera
   * es hoy/mañana/el DOM 4 oct'). Si se omite, se usan defaults razonables
   * según urgency.
   */
  hoursUntilRace?: number;
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
    urgency,
    daysUntil,
    hoursUntilRace,
    raceUrl,
    appUrl,
  } = args;

  const safeUserName = escapeHtml(userName);
  const safeRaceName = escapeHtml(raceName);
  const safeRaceDate = escapeHtml(raceDate);
  const safeVenue = venue ? escapeHtml(venue) : null;
  const safeDorsal = dorsalNumber ? escapeHtml(dorsalNumber) : null;
  const safePredicted = predictedTimeFormatted ? escapeHtml(predictedTimeFormatted) : null;

  // Resolver urgencia: si viene `urgency` gana; si no, derivamos de daysUntil
  // o de hoursUntilRace. hoursUntilRace es lo más preciso.
  let resolvedUrgency: ReminderUrgency;
  if (urgency) {
    resolvedUrgency = urgency;
  } else if (typeof hoursUntilRace === "number") {
    resolvedUrgency = reminderUrgencyFromHours(hoursUntilRace);
  } else if (daysUntil === 1) {
    resolvedUrgency = "tomorrow";
  } else {
    resolvedUrgency = "daysAhead";
  }

  // Para el formato relativo, usamos hoursUntilRace si lo tenemos, si no
  // un default por urgencia coherente.
  const h = typeof hoursUntilRace === "number" ? hoursUntilRace : undefined;
  const fallbackHoursByUrgency: Record<ReminderUrgency, number> = {
    runningNow: 0.5,
    hoursAway: 3,
    eveningBefore: 12,
    tomorrow: 36,
    daysAhead: 168, // 7d
  };
  const effectiveHours = h ?? fallbackHoursByUrgency[resolvedUrgency];
  const whenRelative = formatRaceWhenRelative(effectiveHours, raceTime, raceDate);

  const isRunningNow = resolvedUrgency === "runningNow";
  const isHoursAway = resolvedUrgency === "hoursAway";
  const isEveningBefore = resolvedUrgency === "eveningBefore";
  const isTomorrow = resolvedUrgency === "tomorrow";

  // ===== Subject / preheader =====
  // El subject SIEMPRE menciona la referencia temporal humana para que el
  // corredor entienda de un vistazo de qué carrera es sin abrir el email.
  let subject: string;
  if (isRunningNow || isHoursAway) {
    subject = `🏁 Sales en menos de ${isRunningNow ? "una hora" : "unas horas"}: ${safeRaceName}`;
  } else if (isEveningBefore) {
    subject = `🏁 Tu carrera es esta noche: ${safeRaceName}`;
  } else if (isTomorrow) {
    subject = `🏁 Tu carrera es mañana: ${safeRaceName}`;
  } else {
    subject = `📅 Tu carrera es en 7 días: ${safeRaceName}`;
  }

  let preheader: string;
  if (isRunningNow) {
    preheader = `Estás a punto de salir. Última comprobación: dorsal, gel, agua. ${whenRelative}.`;
  } else if (isHoursAway) {
    preheader = `${safeRaceName} ${whenRelative}. Repasa dorsal, ropa y plan de carrera antes de salir.`;
  } else if (isEveningBefore) {
    preheader = `Tu carrera es esta noche${raceTime ? ` a las ${raceTime}` : ""}. Cena ligera, a la cama temprano, dorsal listo.`;
  } else if (isTomorrow) {
    preheader = `${safeRaceName} ${whenRelative}. Deja dorsal y ropa lista esta noche.`;
  } else {
    preheader = `Quedan 7 días para ${safeRaceName}. Repasa los detalles antes del gran día.`;
  }

  let badgeText: string;
  if (isRunningNow) badgeText = `🏁 Sales ${whenRelative}`;
  else if (isHoursAway) badgeText = `🏁 ${whenRelative}`;
  else if (isEveningBefore) badgeText = `🏁 Tu carrera es esta noche`;
  else if (isTomorrow) badgeText = `🏁 Tu carrera es mañana`;
  else badgeText = `📅 Faltan 7 días`;

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
  // Cada copy está diseñado para tener sentido a la hora real del envío:
  //   runningNow (<1h): el corredor está literalmente saliendo. Confirmar
  //     dorsal, gel, agua. NO decir "cena" ni "duerme".
  //   hoursAway (1-6h): el corredor tiene la tarde/noche por delante. Sí
  //     puede cenar ligero antes. Cita la hora de salida explícitamente.
  //   eveningBefore (6-18h): la carrera es hoy por la tarde/noche. SÍ
  //     hablamos de cenar temprano e irse a la cama.
  //   tomorrow (18-48h): la carrera es mañana. Recomendar preparar esta
  //     noche, no dormir poco, no cenar pesado.
  //   daysAhead (48h+): planificación a varios días.
  let bodyCopy: string;
  if (isRunningNow) {
    bodyCopy = `Estás a punto de salir. Confirma dorsal, gel y agua, y a la cámara de llamadas. Tu carrera empieza ${whenRelative}${raceTime ? "" : ""}.`;
  } else if (isHoursAway) {
    bodyCopy = `Tu carrera es ${whenRelative}. Te da tiempo a hacer vida normal: come ligero en las próximas horas (la última comida 3h antes de la salida), deja la ropa y el dorsal listos, y sal con margen.${raceTime ? "" : ""}`;
  } else if (isEveningBefore) {
    bodyCopy = `Tu carrera es esta noche${raceTime ? `, a las ${raceTime}` : ""}. Cena ligero en las próximas 2-3 horas, a la cama temprano, y dorsal listo junto a la puerta. Mañana solo toca correr.`;
  } else if (isTomorrow) {
    bodyCopy = `${safeRaceName} ${whenRelative}. Deja dorsal y ropa preparada esta noche; cena ligero y a dormir bien. ${raceTime ? `Mañana sal ${raceTime}, ` : ""}primera comida 3h antes.`;
  } else {
    bodyCopy = `Todavía tienes margen para el último ajuste: hidratación, sueño y algún rodaje suave. Nada de estrenar zapatillas.`;
  }

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
    (isRunningNow || isHoursAway || isEveningBefore)
      ? `Tu carrera es ${whenRelative}:`
      : isTomorrow
      ? `Tu carrera es ${whenRelative}:`
      : "Faltan 7 días para tu carrera:",
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
