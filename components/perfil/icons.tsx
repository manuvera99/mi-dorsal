// =============================================================================
// mi-dorsal — Iconos SVG inline para connections
// =============================================================================
// Strava y Garmin tienen logos reconocibles. Los hacemos inline para evitar
// dependencias externas y problemas de CSP.
// =============================================================================

export function StravaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Strava"
    >
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM4.5 13.828L7.585 7.7l3.085 6.128h-3.066L4.5 13.828z" />
    </svg>
  );
}

export function GarminIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Garmin"
    >
      <path d="M12 2L2 12l10 10 10-10L12 2zm0 3l7 7-7 7-7-7 7-7z" />
      <path d="M12 7l-3 5h2v3l3-5h-2V7z" />
    </svg>
  );
}

export { Upload, X, ExternalLink, Clock } from "lucide-react";
