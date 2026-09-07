import { ExternalLink } from "lucide-react";

/**
 * Badge de fuente de datos con enlace.
 *
 * Prioridad de URL (de más específica a más general):
 *  1. `sourceUrl` — la ficha concreta de esta carrera en su fuente
 *     (ej. la URL de la carrera en RFEA, Sportmaniacs, etc.).
 *  2. `officialUrl` — la web oficial de la carrera, como fallback
 *     cuando no tenemos `sourceUrl` o la carrera no tiene fuente asignada.
 *  3. Si ninguna existe, badge sin enlace.
 *
 * Pensado para la tabla de /admin/races pero reutilizable en cualquier
 * vista admin que muestre origen de una carrera.
 */
export function SourceBadge({
  sourceName,
  sourceUrl,
  officialUrl,
  className = "",
}: {
  /** Nombre de la fuente (RFEA, Sportmaniacs, manual, …). Si no hay, se renderiza un guion. */
  sourceName?: string | null;
  /** URL concreta de la carrera dentro de la fuente (r.sourceUrl). */
  sourceUrl?: string | null;
  /** URL oficial de la carrera (r.officialUrl) — fallback. */
  officialUrl?: string | null;
  className?: string;
}) {
  if (!sourceName) {
    return <span className={`text-gray-400 ${className}`}>—</span>;
  }

  const href = sourceUrl || officialUrl || null;

  const baseClass =
    "inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs";

  if (!href) {
    return <span className={baseClass}>{sourceName}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={
        sourceUrl
          ? `Abrir "${sourceName}" en la fuente del dato`
          : `Abrir la web oficial de la carrera`
      }
      className={`${baseClass} hover:bg-runner-primary/10 hover:text-runner-primary transition-colors max-w-[180px]`}
    >
      <span className="truncate">{sourceName}</span>
      <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
    </a>
  );
}
