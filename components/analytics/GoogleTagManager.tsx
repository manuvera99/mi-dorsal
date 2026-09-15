import Script from "next/script";

/**
 * Google Tag Manager.
 * Carga GTM en head + fallback noscript en body.
 * Útil cuando se quiere gestionar múltiples tags (GA4 + AdSense + Conversiones)
 * desde el panel de GTM en vez de meter varios scripts en el código.
 *
 * RGPD (15 sep 2026): GTM arranca con consent mode "default denied"
 * para todos los almacenamientos. El CookieBanner hace "consent update"
 * cuando el usuario acepta (analytics_storage: granted, ad_storage: granted).
 * Hasta entonces, ningún tag de GTM puede poner cookies ni leer datos.
 * wait_for_update: 500 = el banner tiene 500ms para responder antes de que
 * GTM asuma "denied" implícito.
 *
 * strategy (sep 2026): probado `lazyOnload` esperando bajar TTI/LCP. NO
 * funcionó en PSI mobile (Performance 90 → 85, TTI 3.9s → 7.5s). Causa:
 * PSI simula mobile 4G donde el browser tarda más en llegar al idle, así
 * que lazyOnload termina bloqueando el TTI igual pero más tarde.
 * Volvemos a `afterInteractive` para PSI-friendly. Si en producción real
 * (conexiones rápidas) lazyOnload fuera mejor, habría que hacerlo por
 * feature flag midiendo RUM, no por PSI.
 */
export function GoogleTagManager({ gtmId }: { gtmId: string }) {
  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            'gtm.start': new Date().getTime(),
            event: 'gtm.js',
            'gtm.consent': {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied',
              wait_for_update: 500
            }
          });
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `}
      </Script>
    </>
  );
}
