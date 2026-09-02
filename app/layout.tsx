import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "mi-dorsal · Tu planificador de carreras",
  description: "Planifica tu temporada de carreras, predice tu tiempo en cada una, y recibe tu resultado oficial por email.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col">
        <ConvexClientProvider>
          <Header mockMode={useMock} />
          <main className="flex-1">{children}</main>
          <Footer />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
