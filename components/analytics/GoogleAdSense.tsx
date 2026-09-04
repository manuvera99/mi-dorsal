"use client";

import Script from "next/script";

/**
 * Google AdSense.
 * ⚠️  NO ACTIVAR hasta tener:
 * 1. Dominio propio (no *.vercel.app)
 * 2. Aprobación de AdSense (suelen pedir >3 meses online, contenido original, tráfico real)
 * 3. Páginas legales (privacidad + cookies) publicadas — ya las creamos en este PR
 * 4. Banner de cookies implementado — ya lo creamos
 *
 * Para activar: setear NEXT_PUBLIC_ADSENSE_CLIENT_ID en env y descomentar el <Script>.
 * Mientras tanto, el componente existe pero no carga nada.
 */
export function GoogleAdSense({ adClient }: { adClient: string }) {
  // Solo carga si hay un ad-client configurado Y la URL NO es de Vercel (AdSense rechaza subdominios)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const isVercelSubdomain = /\.vercel\.app$/i.test(new URL(appUrl).hostname);
  const shouldLoad = adClient && adClient.length > 5 && !isVercelSubdomain;

  if (!shouldLoad) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

/**
 * Componente para colocar un bloque de anuncio concreto.
 * Uso:
 *   <AdSlot adSlot="1234567890" format="auto" />
 */
export function AdSlot({
  adSlot,
  format = "auto",
  className = "",
  style,
}: {
  adSlot: string;
  format?: "auto" | "fluid" | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={style ?? { display: "block" }}
      data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
      data-ad-slot={adSlot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
