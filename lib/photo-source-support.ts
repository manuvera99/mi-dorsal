// =============================================================================
// mi-dorsal — Proveedores de fotos: qué se puede buscar vs. solo link-out
// =============================================================================
// El backend de "Encuentra tus fotos" (photo-search-api/findmyrace/sources/)
// solo sabe descargar y analizar álbumes de Flickr y ChipLevante. Facebook,
// Google Photos y Google Drive quedan aquí como link-out — Facebook y Google
// Photos por descarte real (ver docs/optional/photo-sources.md §3.1.1):
// Facebook prohíbe scraping en sus Términos de Servicio con enforcement
// legal activo; Google Photos exige OAuth del propietario del álbum y su
// HTML de álbum compartido no trae el contenido completo (carga por JS).
//
// Google Drive es distinto: confirmado con una prueba real (15 sep 2026)
// que SÍ es técnicamente viable como adapter (una cuenta de servicio propia,
// sin ser añadida como colaboradora, puede leer una carpeta compartida como
// "cualquiera con el enlace") — está aquí no por inviabilidad, sino porque
// 0 de 2652 carreras del catálogo apuntan a Drive hoy. Si eso cambia,
// quitarlo de `UNSEARCHABLE_DOMAIN_PATTERNS` y construir el
// `GoogleDrivePhotoSource` real es el siguiente paso, no reinvestigar la
// viabilidad (ya confirmada).
//
// Para las carreras de esta lista, en vez de intentar precargar el enlace en
// el formulario de búsqueda por selfie (que el backend rechazaría con un
// 400), se ofrece un link-out simple: el usuario puede abrir el álbum
// externo y mirar sus fotos a mano, sin búsqueda automática.
// =============================================================================

export type UnsearchablePhotoProvider = "facebook" | "google_photos" | "google_drive";

const UNSEARCHABLE_DOMAIN_PATTERNS: { provider: UnsearchablePhotoProvider; re: RegExp }[] = [
  { provider: "facebook", re: /(^|\.)facebook\.com$/i },
  { provider: "facebook", re: /(^|\.)fb\.watch$/i },
  { provider: "google_photos", re: /(^|\.)photos\.app\.goo\.gl$/i },
  { provider: "google_photos", re: /(^|\.)photos\.google\.com$/i },
  { provider: "google_drive", re: /(^|\.)drive\.google\.com$/i },
];

const UNSEARCHABLE_PROVIDER_LABELS: Record<UnsearchablePhotoProvider, string> = {
  facebook: "Facebook",
  google_photos: "Google Photos",
  google_drive: "Google Drive",
};

/** Si `url` es de un proveedor que sabemos que el backend no puede buscar
 *  automáticamente (Facebook, Google Photos, Google Drive), devuelve de
 *  cuál — para mostrar un link-out en vez de un formulario de búsqueda que
 *  fallaría. `null` si es de un proveedor soportado (Flickr, ChipLevante) o
 *  desconocido (se deja que el backend decida). */
export function detectUnsearchablePhotoProvider(url: string): UnsearchablePhotoProvider | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const { provider, re } of UNSEARCHABLE_DOMAIN_PATTERNS) {
    if (re.test(hostname)) return provider;
  }
  return null;
}

export function unsearchableProviderLabel(provider: UnsearchablePhotoProvider): string {
  return UNSEARCHABLE_PROVIDER_LABELS[provider];
}
