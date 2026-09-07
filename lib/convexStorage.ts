// =============================================================================
// mi-dorsal — Convex File Storage helpers (server-side)
// =============================================================================
// Encapsula la subida de archivos a Convex File Storage desde el servidor
// (Next.js API routes). Usa fetch nativo, no la SDK de Convex, para que sea
// agnóstico al runtime.
// =============================================================================

import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Pide una signed upload URL a Convex. Devuelve la URL a la que hay que
 * hacer POST con el archivo.
 */
export async function convexStorageGenerateUploadUrl(
  convex: ConvexHttpClient,
): Promise<string> {
  // Convex expone `storage:generateUploadUrl` como action interna.
  // El cliente la llama igual que cualquier otra action.
  return await convex.action("storage:generateUploadUrl" as any, {});
}

/**
 * Sube un File a una signed URL de Convex. Devuelve el storageId tipado
 * correctamente para que TS no se queje al pasarlo a mutations de Convex.
 */
export async function convexStorageUpload(
  uploadUrl: string,
  file: File | Blob,
): Promise<Id<"_storage">> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Convex storage upload failed: ${res.status} ${res.statusText} ${text}`,
    );
  }

  const json = (await res.json()) as { storageId: string };
  return json.storageId as Id<"_storage">;
}
