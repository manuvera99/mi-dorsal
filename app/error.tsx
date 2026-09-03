"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mi-dorsal page error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-6 border">
        <h1 className="text-2xl font-bold text-red-600 mb-3">💥 Error en la página</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm font-mono text-red-900 break-all">
          <strong>{error.name}:</strong> {error.message}
        </div>
        {error.digest && (
          <p className="text-xs text-red-700 mb-4">digest: {error.digest}</p>
        )}
        {error.stack && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-gray-600">Stack</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-48">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <button onClick={() => reset()} className="bg-runner-primary text-white px-4 py-2 rounded-md font-semibold">
            Reintentar
          </button>
          <a href="/" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold">Inicio</a>
        </div>
      </div>
    </div>
  );
}
