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
  // Headers de caché y CORS.
  // Antes solo /og-image.png tenía `immutable`. Los favicons y el manifest
  // venían con `max-age=0, must-revalidate` (default de Vercel para archivos
  // en la raíz sin hash), forzando revalidación en cada visita. Con estos
  // headers los assets estáticos se sirven una vez y se cachean en el
  // navegador durante 1 año.
  async headers() {
    return [
      {
        source: "/og-image.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
      {
        // Favicons y manifest: 1 año, immutable.
        // Importante: estos paths no tienen hash en el nombre, así que si
        // algún día se cambia un favicon hay que renombrarlo a su versión
        // nueva (favicon-32x32.v2.png) para que el navegador refresque.
        source: "/(favicon-16x16.png|favicon-32x32.png|favicon-48x48.png|apple-touch-icon.png|manifest.webmanifest)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
