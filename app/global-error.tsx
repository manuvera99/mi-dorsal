"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debug
    console.error("[mi-dorsal global error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">💥</div>
            <h1 className="text-2xl font-bold text-red-600">Error en la app</h1>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-sm font-mono text-red-900 break-all">
              <strong>{error.name}:</strong> {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-700 mt-2">digest: {error.digest}</p>
            )}
          </div>

          {error.stack && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                Ver stack trace
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => reset()}
              className="bg-runner-primary text-white px-4 py-2 rounded-md font-semibold hover:opacity-90"
            >
              Reintentar
            </button>
            <a
              href="/"
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300"
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
