/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Imágenes optimizadas (era `unoptimized: true` — esto mataba LCP/SEO).
  // Con `unoptimized: false` Next.js sirve WebP/AVIF automático.
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Dominios externos de donde pueden venir imágenes de carreras.
    // Ampliar cuando se sepa de qué CDNs vienen los carteles/scrapers.
    remotePatterns: [
      { protocol: "https", hostname: "**" }, // Por ahora permitimos todos (carteles scrapeados)
    ],
    // Cache-Control para las imágenes optimizadas
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 días
  },
  experimental: {
    reactCompiler: false,
  },
  // Compresión: Vercel ya lo hace, pero por si se despliega en otro lado
  compress: true,
  // poweredByHeader: false — quita X-Powered-By por seguridad
  poweredByHeader: false,
  // Headers CORS para Open Graph images
  async headers() {
    return [
      {
        source: "/og-image.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
