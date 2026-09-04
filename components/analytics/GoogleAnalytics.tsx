"use client";

import Script from "next/script";

/**
 * Google Analytics 4 — carga lazy para no afectar LCP.
 * El consentimiento lo gestiona el CookieBanner vía `window.gtag("consent", "update", ...)`.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      {/* Inicializa dataLayer y gtag con consentimiento por defecto denegado */}
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            send_page_view: true
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
