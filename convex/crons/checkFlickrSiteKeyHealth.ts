// =============================================================================
// mi-dorsal — Cron: check-flickr-site-key-health
// =============================================================================
// "Encuentra tus fotos" descarga álbumes de Flickr sin una API key propia
// (ver photo-search-api/findmyrace/sources/flickr.py, docstring del
// módulo): reutiliza el `site_key` público que el propio frontend de
// flickr.com expone inline en el HTML de sus páginas. Investigado el 15
// sep 2026 tras un bloqueo real de Flickr: pedir una key de API propia
// exige cuenta Flickr Pro (82€/año) — aplazado hasta que la feature
// facture; mientras tanto seguimos con este workaround.
//
// Riesgo real de ese workaround: no es que el valor del site_key cambie
// (eso se resuelve solo, se extrae en caliente en cada búsqueda, nunca se
// cachea) — es que Flickr cambie CÓMO lo expone en el HTML (nombre de
// variable, ubicación, movido a una llamada AJAX separada). Si eso pasa,
// la vía principal de listar álbumes/fotos deja de funcionar en
// silencio (cae al scraper HTML por página, más limitado) hasta que
// alguien lo note en una búsqueda real fallida — igual que el bloqueo
// de 429 de esta misma sesión pasó desapercibido hasta revisar logs.
//
// Este cron llama a GET /api/health/flickr_site_key (ver
// photo-search-api/api/find_photos.py) una vez al día y avisa por email
// al admin si deja de poder extraerse — para tener margen de reacción
// antes de que se traduzca en búsquedas fallidas en producción.
// =============================================================================

"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const checkFlickrSiteKeyHealth = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; skipped?: boolean }> => {
    const apiUrl = process.env.PHOTO_SEARCH_API_URL;
    const apiSecret = process.env.PHOTO_SEARCH_API_SECRET;
    if (!apiUrl) {
      // Sin PHOTO_SEARCH_API_URL no hay servicio al que preguntar (p. ej.
      // en el deployment de PRE) — no es un fallo real, solo no aplica.
      console.log("[check-flickr-site-key-health] PHOTO_SEARCH_API_URL no configurada, se omite");
      return { ok: true, skipped: true };
    }

    let ok = false;
    let detail = "";
    try {
      const resp = await fetch(`${apiUrl}/api/health/flickr_site_key`, {
        headers: apiSecret ? { Authorization: `Bearer ${apiSecret}` } : {},
      });
      if (!resp.ok) {
        detail = `El servicio respondió ${resp.status}`;
      } else {
        const body = (await resp.json()) as {
          ok: boolean;
          siteKeyFound: boolean;
          nsidFound: boolean;
        };
        ok = body.ok;
        if (!ok) {
          detail = `siteKeyFound=${body.siteKeyFound}, nsidFound=${body.nsidFound}`;
        }
      }
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err);
    }

    if (ok) {
      console.log("[check-flickr-site-key-health] OK — site_key/NSID se extraen correctamente");
      return { ok: true };
    }

    console.error(`[check-flickr-site-key-health] FALLO: ${detail}`);
    await ctx.scheduler.runAfter(0, internal.emails.sendEmail.sendEmail, {
      to: process.env.ADMIN_NOTIFICATION_EMAIL || "hola@mi-dorsal.com",
      subject: "⚠️ Flickr site_key: la extracción ha dejado de funcionar",
      html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf9;padding:24px;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#dc2626;color:#fff;padding:16px 20px;">
      <h1 style="margin:0;font-size:18px;">⚠️ Flickr site_key: la extracción ha dejado de funcionar</h1>
    </div>
    <div style="padding:20px;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
        "Encuentra tus fotos" descarga álbumes de Flickr reutilizando el
        <code>site_key</code> público del HTML de flickr.com (sin API key
        propia — ver docstring de <code>findmyrace/sources/flickr.py</code>).
        El chequeo diario contra un perfil público conocido ha fallado:
      </p>
      <div style="padding:14px;background:#f5f5f4;border-radius:6px;border-left:3px solid #dc2626;">
        <p style="margin:0;font-family:monospace;font-size:13px;">${escapeHtml(detail)}</p>
      </div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.5;">
        Probablemente Flickr cambió cómo expone <code>site_key</code>/NSID
        en el HTML. Las búsquedas de fotos pueden estar fallando o cayendo
        al scraper HTML por página (más limitado) desde ahora.
      </p>
    </div>
  </div>
</body></html>`,
      text: `Flickr site_key: la extracción ha dejado de funcionar\n\n${detail}\n\n"Encuentra tus fotos" descarga álbumes de Flickr reutilizando el site_key público del HTML de flickr.com (sin API key propia). Probablemente Flickr cambió cómo lo expone. Revisar findmyrace/sources/flickr.py.`,
    });

    return { ok: false };
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
