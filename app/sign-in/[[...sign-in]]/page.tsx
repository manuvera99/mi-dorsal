import { SignIn } from "@clerk/nextjs";
import { isMockMode } from "@/lib/mock/provider";

export default function Page() {
  // En modo mock, Clerk no está configurado. Mostramos un placeholder.
  if (isMockMode()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4">
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
          <a
            href="/"
            className="inline-block bg-runner-primary text-white px-4 py-2 rounded-md hover:opacity-90"
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
          },
        }}
      />
    </div>
  );
}
