"use client";

/**
 * Secciones extra del detalle de carrera que se nutren de los datos
 * de extracción profunda (Fase 1). Cada componente renderiza solo si
 * la carrera tiene los datos relevantes — si no, devuelve null.
 */

import {
  Layers, MapPin, Users, Clock, Euro, TrendingUp, Droplets, Apple,
  Cross, Stethoscope, Mountain, Car, Coffee, Image as ImageIcon,
  ExternalLink, Ticket, ChevronRight, AlertCircle,
} from "lucide-react";
import type { ReactNode } from "react";

// =====================================================================
// Section wrapper (consistencia visual)
// =====================================================================
export function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon?: any;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-runner-primary" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="card">{children}</div>
    </section>
  );
}

// =====================================================================
// Modalidades (raceFormats) — una card por modalidad
// =====================================================================
export function RaceFormatsSection({ race }: { race: any }) {
  if (!race.raceFormats || race.raceFormats.length === 0) return null;
  return (
    <Section title="Modalidades" icon={Layers}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {race.raceFormats.map((f: any, i: number) => (
          <div
            key={i}
            className="rounded-lg border-2 border-gray-200 hover:border-runner-primary transition-colors p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Modalidad</div>
                <div className="text-xl font-bold text-runner-primary">{f.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {f.distanceKm.toFixed(f.distanceKm % 1 === 0 ? 0 : 2)}
                </div>
                <div className="text-xs text-gray-500">km</div>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {f.elevationGainM && f.elevationGainM > 0 && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Mountain className="h-3.5 w-3.5 text-gray-400" />
                  <span>+{f.elevationGainM} m desnivel</span>
                </div>
              )}
              {f.startTime && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span>Salida: {f.startTime}h</span>
                </div>
              )}
              {f.priceEur && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Euro className="h-3.5 w-3.5 text-gray-400" />
                  <span>
                    <strong>{f.priceEur} €</strong>
                  </span>
                </div>
              )}
              {f.maxParticipants && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  <span>{f.maxParticipants.toLocaleString()} dorsales</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// =====================================================================
// Avituallamientos (aidStations) — timeline visual
// =====================================================================
export function AidStationsSection({ race }: { race: any }) {
  if (!race.aidStations || race.aidStations.length === 0) return null;
  const maxKm = Math.max(race.distanceKm || 0, ...race.aidStations.map((a: any) => a.km));

  return (
    <Section title="Avituallamientos en ruta" icon={Coffee}>
      <p className="text-sm text-gray-600 mb-4">
        {race.aidStations.length} puntos de avituallamiento a lo largo del recorrido
      </p>

      {/* Timeline visual */}
      <div className="relative">
        {/* Línea base */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-3 left-0 h-0.5 bg-runner-primary"
          style={{ width: `${(Math.max(...race.aidStations.map((a: any) => a.km)) / maxKm) * 100}%` }}
        />

        {/* Puntos */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${race.aidStations.length}, minmax(0, 1fr))` }}
        >
          {race.aidStations.map((a: any, i: number) => (
            <div key={i} className="flex flex-col items-center">
              <div className="relative z-10 w-6 h-6 rounded-full bg-runner-primary text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                {a.km === 0 ? "🚀" : a.km >= race.distanceKm ? "🏁" : "•"}
              </div>
              <div className="mt-2 text-center text-xs">
                <div className="font-bold">km {a.km}</div>
                {a.name && <div className="text-gray-500 line-clamp-1">{a.name}</div>}
                <div className="flex justify-center gap-0.5 mt-1">
                  {a.hasWater && <span title="Agua">💧</span>}
                  {a.hasIsotonic && <span title="Isotónico">🧃</span>}
                  {a.hasFood && <span title="Sólido">🍌</span>}
                  {a.hasMedical && <span title="Médico">⚕️</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detalle textual */}
      <details className="mt-4">
        <summary className="text-sm text-runner-primary cursor-pointer hover:underline">
          Ver detalle de cada avituallamiento
        </summary>
        <table className="w-full text-sm mt-3">
          <thead className="text-xs text-gray-500 border-b">
            <tr>
              <th className="text-left py-1">Km</th>
              <th className="text-left py-1">Nombre</th>
              <th className="text-center py-1">Agua</th>
              <th className="text-center py-1">Isotónico</th>
              <th className="text-center py-1">Sólido</th>
              <th className="text-center py-1">Médico</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {race.aidStations.map((a: any, i: number) => (
              <tr key={i}>
                <td className="py-1.5 font-mono font-bold">{a.km}</td>
                <td className="py-1.5 text-gray-700">{a.name ?? "—"}</td>
                <td className="py-1.5 text-center">{a.hasWater ? "✓" : ""}</td>
                <td className="py-1.5 text-center">{a.hasIsotonic ? "✓" : ""}</td>
                <td className="py-1.5 text-center">{a.hasFood ? "✓" : ""}</td>
                <td className="py-1.5 text-center">{a.hasMedical ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Section>
  );
}

// =====================================================================
// Tramos de precio (priceTiers) — tabla con fechas
// =====================================================================
export function PriceTiersSection({ race }: { race: any }) {
  if (!race.priceTiers || race.priceTiers.length === 0) return null;
  return (
    <Section title="Tramos de precio" icon={Euro}>
      <p className="text-sm text-gray-600 mb-3">
        El precio sube según la cercanía a la carrera. Apúntate pronto para ahorrar.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b">
            <tr>
              <th className="text-left py-2">Tramo</th>
              <th className="text-left py-2">Desde</th>
              <th className="text-left py-2">Hasta</th>
              <th className="text-right py-2">Precio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {race.priceTiers.map((t: any, i: number) => {
              const dateFrom = new Date(t.fromDate);
              const isActive =
                dateFrom <= new Date() &&
                (!t.toDate || new Date(t.toDate) > new Date());
              return (
                <tr
                  key={i}
                  className={isActive ? "bg-green-50 font-semibold" : ""}
                >
                  <td className="py-2">
                    {t.label ?? `Tramo ${i + 1}`}
                    {isActive && (
                      <span className="ml-2 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
                        ACTIVO
                      </span>
                    )}
                  </td>
                  <td className="py-2">{formatDateShort(t.fromDate)}</td>
                  <td className="py-2">{t.toDate ? formatDateShort(t.toDate) : "—"}</td>
                  <td className="py-2 text-right font-mono font-bold">{t.priceEur} €</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// =====================================================================
// Dorsal pickup
// =====================================================================
export function DorsalPickupSection({ race }: { race: any }) {
  if (!race.dorsalPickupLocation && !race.dorsalPickupHours) return null;
  return (
    <Section title="Recogida de dorsal" icon={Ticket}>
      <div className="space-y-2 text-sm">
        {race.dorsalPickupLocation && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Lugar</div>
              <div className="font-semibold">{race.dorsalPickupLocation}</div>
            </div>
          </div>
        )}
        {race.dorsalPickupHours && (
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Horario</div>
              <div className="font-semibold">{race.dorsalPickupHours}</div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// =====================================================================
// Galería
// =====================================================================
export function GallerySection({ race }: { race: any }) {
  if (!race.galleryUrls || race.galleryUrls.length === 0) return null;
  const [first, ...rest] = race.galleryUrls;
  return (
    <Section title="Galería" icon={ImageIcon}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {first && (
          <a
            href={first}
            target="_blank"
            rel="noreferrer"
            className="col-span-2 row-span-2 relative aspect-square rounded-md overflow-hidden group"
          >
            <img
              src={first}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </a>
        )}
        {rest.map((u: string, i: number) => (
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="relative aspect-square rounded-md overflow-hidden group"
          >
            <img
              src={u}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </a>
        ))}
      </div>
    </Section>
  );
}

// =====================================================================
// Long description (separado de description, más rico)
// =====================================================================
export function LongDescriptionSection({ race }: { race: any }) {
  if (!race.longDescription) return null;
  return (
    <Section title="Sobre la carrera" icon={ChevronRight}>
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
        {race.longDescription}
      </div>
    </Section>
  );
}

// =====================================================================
// Mapa + altimetría imagen (más prominente)
// =====================================================================
export function CourseVisualsSection({ race }: { race: any }) {
  const hasMap = !!(race.mapUrl || race.mapImageUrl || race.mapEmbedUrl);
  const hasProfile = !!(race.altimetryImageUrl || race.profileImageUrl);
  if (!hasMap && !hasProfile) return null;

  return (
    <Section title="Recorrido y perfil" icon={TrendingUp}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasMap && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Mapa</div>
            {race.mapEmbedUrl ? (
              <iframe
                src={race.mapEmbedUrl}
                className="w-full aspect-video rounded-md border"
                title="Mapa del recorrido"
                loading="lazy"
              />
            ) : (
              <a
                href={race.mapUrl || race.mapImageUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={race.mapImageUrl || race.mapUrl}
                  alt="Mapa del recorrido"
                  className="w-full rounded-md border hover:opacity-90 transition-opacity"
                />
              </a>
            )}
            {race.gpxUrl && (
              <a
                href={race.gpxUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-runner-primary hover:underline mt-2"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Descargar track GPX
              </a>
            )}
          </div>
        )}
        {hasProfile && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Perfil de elevación
              <span className="text-gray-400 ml-1">(+{race.elevationGainM ?? "?"} m)</span>
            </div>
            <a
              href={race.altimetryImageUrl || race.profileImageUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={race.altimetryImageUrl || race.profileImageUrl}
                alt="Perfil de elevación"
                className="w-full rounded-md border bg-white hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        )}
      </div>
    </Section>
  );
}

// =====================================================================
// Helpers
// =====================================================================
function formatDateShort(date: string): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return date;
  }
}
