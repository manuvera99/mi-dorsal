import { SignIn } from "@clerk/nextjs";
import { isMockMode } from "@/lib/mock/provider";
import Link from "next/link";

export default function Page() {
  // En modo mock, Clerk no está configurado. Mostramos un placeholder.
  if (isMockMode()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-runner-warm py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-runner-primary text-white">
            <span className="text-2xl">🏃</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Sign in</h1>
          <p className="text-gray-600 mb-6">
            Estás en modo mock (local). Clerk no está configurado en este entorno.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            En producción, aquí verás un formulario de magic-link / email + password.
          </p>
          <Link
            href="/"
            className="inline-block bg-runner-primary text-white px-4 py-2 rounded-md hover:opacity-90"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-runner-warm py-12 px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#dc2626",
            colorBackground: "#fafaf9",
            colorInputBackground: "#ffffff",
            colorInputText: "#0a0a0a",
            colorText: "#0a0a0a",
            colorTextSecondary: "#57534e",
            colorDanger: "#dc2626",
            colorSuccess: "#16a34a",
            borderRadius: "0.5rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
          },
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl border border-gray-200",
            // Botón principal: fondo rojo asfalto
            formButtonPrimary:
              "bg-runner-primary text-white hover:opacity-90 text-sm font-semibold normal-case",
            // Links y social buttons
            socialButtonsBlockButton:
              "border border-gray-300 hover:bg-gray-50 text-gray-700",
            socialButtonsBlockButtonText: "font-medium text-gray-700",
            // Inputs
            formFieldInput:
              "border border-gray-300 focus:border-runner-primary focus:ring-runner-primary rounded-md",
            // Footer (términos y privacidad)
            footerActionLink: "text-runner-primary hover:underline font-medium",
            // Header de la card
            cardBox: "rounded-xl",
            // Badge "Development mode" más sutil
            badge: "bg-amber-50 text-amber-800 border border-amber-200",
          },
        }}
      />
    </div>
  );
}
