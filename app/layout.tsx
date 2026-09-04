import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/components/json-ld";
import { GoogleAdSense } from "@/components/analytics/GoogleAdSense";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mi-dorsal.vercel.app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "mi-dorsal · Planifica tu temporada de carreras",
    template: "%s · mi-dorsal",
  },
  description:
    "Catálogo de carreras populares en toda España. Predice tu tiempo, planifica tu temporada y recibe tu resultado oficial por email.",
  applicationName: "mi-dorsal",
  keywords: [
    "carreras populares",
    "carreras España",
    "running España",
    "trail running",
    "10K",
    "media maratón",
    "maratón",
    "planificador carreras",
    "resultados carreras",
    "dorsal",
    "predicción tiempo",
    "RFEA",
    "FEDME",
  ],
  authors: [{ name: "mi-dorsal", url: BASE_URL }],
  creator: "mi-dorsal",
  publisher: "mi-dorsal",
  category: "sports",
  classification: "Sports & Recreation",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "es-ES": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: BASE_URL,
    siteName: "mi-dorsal",
    title: "mi-dorsal · Planifica tu temporada de carreras",
    description:
      "Catálogo de carreras populares en toda España. Predice tu tiempo, planifica tu temporada y recibe tu resultado oficial por email.",
    images: [
      {
        url: "/og-image",
        width: 1200,
        height: 630,
        alt: "mi-dorsal — Planifica tu temporada de carreras",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@midorsal",
    creator: "@midorsal",
    title: "mi-dorsal · Planifica tu temporada de carreras",
    description:
      "Catálogo de carreras populares en toda España. Predice tu tiempo, planifica tu temporada y recibe tu resultado oficial por email.",
    images: ["/og-image"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-32x32.png", sizes: "32x32" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "mi-dorsal",
  },
  other: {
    "google-site-verification": process.env.NEXT_PUBLIC_GSC_VERIFICATION || "",
    "facebook-domain-verification": process.env.NEXT_PUBLIC_FB_VERIFICATION || "",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="es-ES" dir="ltr">
      <head>
        {/* DNS prefetch + preconnect para recursos externos críticos */}
        <link rel="preconnect" href="https://clerk.accounts.dev" crossOrigin="anonymous" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ? `https://${process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}` : "https://convex.cloud"} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
      </head>
      <body className="min-h-screen flex flex-col">
        {/* JSON-LD estructurado: Organization + WebSite con SearchAction */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />

        {/* Google Tag Manager (noscript fallback) */}
        {gtmId && <GoogleTagManager gtmId={gtmId} />}

        <ConvexClientProvider>
          <Header mockMode={useMock} />
          <main className="flex-1">{children}</main>
          <Footer />
        </ConvexClientProvider>

        {/* Google Analytics 4 */}
        {gaId && <GoogleAnalytics measurementId={gaId} />}

        {/* Google AdSense (auto-desactivado en *.vercel.app y sin client ID) */}
        <GoogleAdSense adClient={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || ""} />

        {/* Banner de cookies (RGPD) */}
        <CookieBanner />
      </body>
    </html>
  );
}
