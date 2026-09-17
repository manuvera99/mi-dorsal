"use server";

// =============================================================================
// Wrapper local para mantener compat con el import `from "./actions"` en
// page.tsx. La implementación canónica vive en
// @/lib/ai/extract-from-url-action para que el wizard público pueda
// importarlo sin depender de /admin/.
//
// Next.js no permite `export { x } from "y"` en archivos "use server" (sólo
// acepta declaraciones `export async function` o `export const` con función
// async), por eso este wrapper trivial.
// =============================================================================

import { extractFromUrl as extractFromUrlCanonical } from "@/lib/ai/extract-from-url-action";

export async function extractFromUrl(url: string) {
  return extractFromUrlCanonical(url);
}
