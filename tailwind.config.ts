import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./convex/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        runner: {
          primary: "#dc2626",
          accent: "#16a34a",
          warm: "#fafaf9",
          dark: "#0a0a0a",
        },
      },
      fontFamily: {
        // Usamos la variable CSS que inyecta next/font (definida en
        // app/layout.tsx). El fallback system-ui evita FOUT si el bundle
        // de Inter aún no ha llegado.
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
