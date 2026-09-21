"use client";

/**
 * DistanceHubClient — vista cliente del hub /carreras/distancia/{distancia}.
 *
 * SEO long-tail target: "carreras 10K en España", "próximas maratones 2026".
 */
import Link from "next/link";
import { Calendar, MapPin, Mountain } from "lucide-react";

export interface DistanceHubRace {
  slug: string;
  name: string;
  locality?: string;
  province?: string;
  startDate?: string;
  distanceKm: number;
  raceType?: "road" | "trail" | "mixed" | "obstacle";
}

interface DistanceHubClientProps {
  label: string;
  slug: string;
  total: number;
  upcoming: number;
  races: DistanceHubRace[];
  siblings: Array<{ label: string; slug: string; total: number }>;
  provinces: Array<{ label: string; slug: string; total: number }>;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

export function DistanceHubClient({
  label,
  slug,
  total,
  upcoming,
  races,
  siblings,
  provinces,
}: DistanceHubClientProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
          Carreras por distancia
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Carreras de {label} en España
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Todas las carreras de {label.toLowerCase()} publicadas en nuestro catálogo.
          {" "}{upcoming > 0
            ? `${upcoming} confirmadas para los próximos meses.`
            : "Pronto publicaremos nuevas pruebas."}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" aria-hidden="true" />
            <dt className="sr-only">Carreras publicadas</dt>
            <dd>
              <span className="font-display text-base font-bold text-foreground">{total}</span>{" "}
              publicadas
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden="true" />
            <dt className="sr-only">Carreras próximas</dt>
            <dd>
              <span className="font-display text-base font-bold text-foreground">{upcoming}</span>{" "}
              próximas
            </dd>
          </div>
        </dl>
      </header>

      {/* OTRAS DISTANCIAS */}
      <nav aria-label="Otras distancias" className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Otras distancias
        </h2>
        <ul className="flex flex-wrap gap-2">
          {siblings.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/carreras/distancia/${s.slug}`}
                className={`inline-flex items-center rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  s.slug === slug
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background hover:border-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                {s.label}{" "}
                <span className="ml-1 text-[0.625rem] opacity-60">({s.total})</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* GRID DE CARRERAS */}
      {races.length > 0 ? (
        <section aria-label={`Carreras de ${label}`} className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold tracking-tight">
            Próximas carreras de {label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <article
                key={r.slug}
                className="group flex flex-col gap-3 rounded-md border bg-card p-4 transition-colors hover:border-foreground"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {r.raceType === "trail" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-brand-strong/30 bg-brand/5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-strong">
                      <Mountain className="size-3" aria-hidden="true" />
                      Trail
                    </span>
                  ) : null}
                  <time className="text-xs uppercase tracking-wide" dateTime={r.startDate}>
                    {formatDate(r.startDate)}
                  </time>
                </div>
                <h3 className="font-display text-base font-bold uppercase leading-tight tracking-tight">
                  <Link
                    href={`/carreras/${r.slug}`}
                    className="transition-colors hover:text-brand-strong"
                  >
                    {r.name}
                  </Link>
                </h3>
                {r.locality && r.province ? (
                  <p className="text-sm text-muted-foreground">
                    <MapPin className="mr-1 inline size-3" aria-hidden="true" />
                    {r.locality},{" "}
                    <Link
                      href={`/carreras/provincia/${r.province}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {provinciaLabel(r.province)}
                    </Link>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section
          aria-label={`Carreras de ${label}`}
          className="mb-12 rounded-md border bg-card p-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            No tenemos carreras próximas de {label.toLowerCase()} todavía. Vuelve pronto.
          </p>
        </section>
      )}

      {/* POR PROVINCIA — sub-hubs combinados */}
      {provinces.length > 0 ? (
        <aside aria-label={`${label} por provincia`} className="border-t pt-6">
          <h2 className="mb-4 font-display text-xl font-bold tracking-tight">
            Carreras de {label} por provincia
          </h2>
          <ul className="flex flex-wrap gap-2">
            {provinces.slice(0, 30).map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/carreras/${p.slug}/${slug}`}
                  className="inline-flex items-center gap-1.5 rounded-sm border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  {p.label}{" "}
                  <span className="text-[0.625rem] text-muted-foreground">({p.total})</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

function provinciaLabel(slug: string): string {
  // Mapear slug → label. Importar del helper centralizado en producción.
  const map: Record<string, string> = {
    "alicante": "Alicante",
    "valencia": "Valencia",
    "castellon": "Castellón",
    "madrid": "Madrid",
    "barcelona": "Barcelona",
    "sevilla": "Sevilla",
    "malaga": "Málaga",
    "murcia": "Murcia",
    "vizcaya": "Bizkaia",
    "gipuzkoa": "Gipuzkoa",
    "alava": "Álava",
    "asturias": "Asturias",
    "cantabria": "Cantabria",
    "zaragoza": "Zaragoza",
    "valladolid": "Valladolid",
    "granada": "Granada",
    "badajoz": "Badajoz",
    "a coruna": "A Coruña",
    "pontevedra": "Pontevedra",
    "illes balears": "Illes Balears",
    "mallorca": "Mallorca",
    "las palmas": "Las Palmas",
    "santa cruz de tenerife": "Tenerife",
  };
  return map[slug] ?? slug;
}