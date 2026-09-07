// =============================================================================
// mi-dorsal — POST /api/connect/strava-export/upload
// =============================================================================
// Recibe el ZIP del export de Strava, lo sube a Convex File Storage,
// crea el registro de upload, y dispara la action de ingest.
//
// Flujo:
//   1) Cliente: POST multipart/form-data con el archivo
//   2) Servidor: pide una signed upload URL a Convex File Storage
//   3) Servidor: sube el archivo a esa URL
//   4) Servidor: llama a la mutation createUploadAndStart con el storageId
//   5) Servidor: dispara la action startIngest
//   6) Servidor: devuelve { uploadId } al cliente
//
// Validaciones:
//   - Tamaño max: 200 MB
//   - MIME: application/zip o application/x-zip-compressed
//   - Nombre: max 200 chars
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { convexStorageGenerateUploadUrl, convexStorageUpload } from "@/lib/convexStorage";

export const runtime = "nodejs"; // necesitamos Node.js para FormData y fetch
export const maxDuration = 60; // 60s para subir el archivo

const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream", // algunos navegadores lo mandan así
]);

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

export async function POST(request: NextRequest) {
  try {
    // 1) Parsear multipart
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo" },
        { status: 400 },
      );
    }

    // 2) Validaciones
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB, máximo 200 MB`,
        },
        { status: 413 },
      );
    }

    if (file.size < 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado pequeño para ser un export de Strava" },
        { status: 400 },
      );
    }

    if (file.type && !ALLOWED_MIMES.has(file.type)) {
      // No fallamos por el MIME: algunos navegadores envían octet-stream
      // para ZIPs. Confiamos en la extensión y magic bytes.
      console.warn(`[strava-export/upload] MIME inesperado: ${file.type}`);
    }

    if (file.name.length > 200) {
      return NextResponse.json(
        { error: "Nombre de archivo demasiado largo" },
        { status: 400 },
      );
    }

    // 3) Validar magic bytes (ZIP empieza con PK\x03\x04)
    const firstBytes = await file.slice(0, 4).arrayBuffer();
    const magic = new Uint8Array(firstBytes);
    if (magic[0] !== 0x50 || magic[1] !== 0x4b) {
      return NextResponse.json(
        { error: "El archivo no parece ser un ZIP válido (faltan magic bytes)" },
        { status: 400 },
      );
    }

    // 4) Cliente Convex
    const convexUrl = stripBom(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Convex no configurado" },
        { status: 500 },
      );
    }
    const convex = new ConvexHttpClient(convexUrl);

    // 5) Pedir signed upload URL a Convex
    const uploadUrl = await convexStorageGenerateUploadUrl(convex);

    // 6) Subir el archivo a Convex File Storage
    const storageId = await convexStorageUpload(uploadUrl, file);

    // 7) Crear el upload en Convex
    const { uploadId } = await convex.mutation(api.stravaExport.createUploadAndStart, {
      fileStorageId: storageId,
      fileName: file.name,
      fileSizeBytes: file.size,
    });

    // 8) Disparar la action de ingest (en background)
    //    No esperamos a que termine: el cliente hará polling del estado.
    convex.action(api.stravaExportIngest.startIngest, { uploadId })
      .catch((e) => {
        console.error(`[strava-export/upload] startIngest failed for ${uploadId}:`, e);
      });

    return NextResponse.json({ ok: true, uploadId });
  } catch (e: any) {
    console.error("[strava-export/upload]", e);
    return NextResponse.json(
      { error: e?.message ?? "Error interno al subir el archivo" },
      { status: 500 },
    );
  }
}
