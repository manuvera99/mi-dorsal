"use client";

/**
 * ProvinceHubClient — vista cliente del hub /carreras/{provincia}.
 *
 * Recibe la lista de carreras ya cargada en server (evita hydration mismatch
 * y permite emitir JSON-LD con slugs reales en SSR).
 *
 * SEO long-tail target: "carreras populares {provincia}", "próximas carreras {provincia}".
 */
import Link from "next/link";
import { Calendar, MapPin, Mountain } from "lucide-react";
import { RaceCard } from "@/components/race-card";

export interface ProvinceHubRace {
  slug: string;
  name: string;
  locality?: string;
  province?: string;
  startDate?: string;
  distanceKm: number;
  raceType?: "road" | "trail" | "mixed" | "obstacle";
}

interface ProvinceHubClientProps {
  provinceLabel: string;
  provinceSlug: string;
  total: number;
  upcoming: number;
  races: ProvinceHubRace[];
  siblings: Array<{ label: string; slug: string; total: number }>;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function formatDistance(km: number) {
  if (km >= 40) return `${km.toFixed(0)} km`;
  if (km >= 17.5) return `${km.toFixed(1)} km`;
  return `${km.toFixed(0)} km`;
}

export function ProvinceHubClient({
  provinceLabel,
  provinceSlug,
  total,
  upcoming,
  races,
  siblings,
}: ProvinceHubClientProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      {/* HERO */}
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
          Carreras populares
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Carreras populares en {provinceLabel}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Catálogo de carreras en {provinceLabel} actualizado a diario. {upcoming > 0
            ? `${upcoming} carreras confirmadas para los próximos meses.`
            : "Pronto publicaremos nuevas pruebas en esta provincia."}
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

      {/* NAVEGACIÓN POR DISTANCIA — enlaces a sub-hubs */}
      <nav aria-label="Filtrar por distancia" className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Carreras en {provinceLabel} por distancia
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[
            { slug: "5k", label: "5K" },
            { slug: "10k", label: "10K" },
            { slug: "media-maraton", label: "Media maratón" },
            { slug: "maraton", label: "Maratón" },
            { slug: "trail", label: "Trail" },
            { slug: "ultra", label: "Ultramaratón" },
          ].map((d) => (
            <li key={d.slug}>
              <Link
                href={`/carreras/${provinceSlug}/${d.slug}`}
                className="inline-flex items-center rounded-sm border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* GRID DE CARRERAS */}
      {races.length > 0 ? (
        <section aria-label={`Carreras en ${provinceLabel}`} className="mb-12">
          <h2 className="mb-4 font-display text-xl font-bold tracking-tight">
            Próximas carreras en {provinceLabel}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((r) => (
              <article
                key={r.slug}
                className="group flex flex-col gap-3 rounded-md border bg-card p-4 transition-colors hover:border-foreground"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center rounded-sm border border-foreground/25 px-2 py-0.5 font-display font-bold uppercase tracking-wide text-foreground">
                    {formatDistance(r.distanceKm)}
                  </span>
                  {r.raceType === "trail" ? (
                    <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-brand-strong">
                      <Mountain className="size-3" aria-hidden="true" />
                      Trail
                    </span>
                  ) : null}
                  <time
                    className="ml-auto text-xs uppercase tracking-wide"
                    dateTime={r.startDate}
                  >
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
                {r.locality ? (
                  <p className="text-sm text-muted-foreground">
                    <MapPin className="mr-1 inline size-3" aria-hidden="true" />
                    {r.locality}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section
          aria-label={`Carreras en ${provinceLabel}`}
          className="mb-12 rounded-md border bg-card p-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            De momento no tenemos carreras próximas en {provinceLabel}. Vuelve pronto o
            explora otras provincias abajo.
          </p>
        </section>
      )}

      {/* OTRAS PROVINCIAS — enlazado interno hub-and-spoke */}
      {siblings.length > 0 ? (
        <aside aria-label="Otras provincias" className="border-t pt-6">
          <h2 className="mb-4 font-display text-xl font-bold tracking-tight">
            Carreras por provincia
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/carreras/${s.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-sm border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  {s.label}
                  <span className="text-[0.625rem] text-muted-foreground">({s.total})</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}