"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { formatDate, formatProvince, formatRaceType, formatTime } from "@/lib/utils";
import { RatingSliders } from "@/components/rating-sliders";
import { MapPin, Calendar, Mountain, ExternalLink, FileText, Plus, Check, User } from "lucide-react";
import Link from "next/link";

function MockRaceDetail({ slug }: { slug: string }) {
  const [race, setRace] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    mockApi.races.getBySlug({ slug }).then(async (r) => {
      setRace(r);
      if (r) {
        const s = await mockApi.ratings.summary({ raceId: r._id });
        setSummary(s);
      }
    });
  }, [slug]);

  return <RaceDetailContent race={race} summary={summary} />;
}

function RealRaceDetail({ slug }: { slug: string }) {
  const convexRace = useQuery(api.races.getBySlug, { slug });
  const convexSummary = useQuery(
    api.ratings.summary,
    convexRace ? { raceId: convexRace._id } : "skip" as any,
  );
  return <RaceDetailContent race={convexRace as any} summary={convexSummary as any} />;
}

export function RaceDetailClient({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const useMock = isMockMode();
  return useMock ? <MockRaceDetail slug={slug} /> : <RealRaceDetail slug={slug} />;
}

function RaceDetailContent({ race, summary }: { race: any; summary: any }) {
  const [dorsalInput, setDorsalInput] = useState("");

  if (!race) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-gray-500">
        Cargando carrera…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="badge badge-red">{formatRaceType(race.raceType)}</span>
          {race.homologated && <span className="badge badge-green">Homologada</span>}
          <span className="badge badge-gray">{formatProvince(race.province)}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">{race.name}</h1>
        {race.description && (
          <p className="text-gray-600 text-lg">{race.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: data */}
        <div className="md:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Datos clave</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Distancia</div>
                <div className="text-2xl font-bold text-runner-primary">
                  {race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km
                </div>
              </div>
              {race.elevationGainM !== undefined && race.elevationGainM > 0 && (
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Desnivel</div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <Mountain className="h-5 w-5 text-gray-500" />
                    +{race.elevationGainM} m
                  </div>
                </div>
              )}
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Fecha</div>
                <div className="font-semibold">{formatDate(race.startDate)}</div>
                {race.startTime && <div className="text-sm text-gray-600">{race.startTime}h</div>}
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Localidad</div>
                <div className="font-semibold flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  {race.locality}
                </div>
              </div>
            </div>
            {(race.officialUrl || race.registrationUrl || race.resultsUrl) && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                {race.officialUrl && (
                  <a href={race.officialUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Web oficial
                  </a>
                )}
                {race.registrationUrl && (
                  <a href={race.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Inscribirse
                  </a>
                )}
                {race.resultsUrl && (
                  <a href={race.resultsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Ver resultados
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Ratings summary */}
          {summary && summary.totalRatings > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Valoraciones</h2>
                <div className="text-right">
                  <div className="text-3xl font-bold text-runner-primary">
                    {summary.avgGlobal?.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {summary.totalRatings} {summary.totalRatings === 1 ? "voto" : "votos"}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { key: "avgOrganization", label: "Organización" },
                  { key: "avgPrice", label: "Precio" },
                  { key: "avgSwag", label: "Bolsa del corredor" },
                  { key: "avgAidStations", label: "Avituallamientos" },
                  { key: "avgCourse", label: "Perfil y recorrido" },
                  { key: "avgAtmosphere", label: "Ambiente" },
                  { key: "avgPostRace", label: "Servicios post-meta" },
                  { key: "avgTrophies", label: "Trofeos" },
                ].map((dim) => {
                  const val = (summary as any)[dim.key];
                  if (val === null || val === undefined) return null;
                  return (
                    <div key={dim.key} className="flex items-center gap-3 text-sm">
                      <div className="w-32 text-gray-600">{dim.label}</div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-runner-primary"
                          style={{ width: `${val * 10}%` }}
                        />
                      </div>
                      <div className="w-10 text-right font-mono font-bold">
                        {val.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rating form */}
          <RatingSliders raceId={race._id} />
        </div>

        {/* Right column: add to calendar */}
        <div className="space-y-4">
          <div className="card sticky top-20">
            <h3 className="font-semibold mb-3">¿Vas a correrla?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Añádela a tu calendario y te predecimos tu tiempo.
              Te llegará el resultado oficial por email.
            </p>
            <div className="space-y-2">
              <label className="label">Tu dorsal (si ya te has inscrito)</label>
              <input
                type="text"
                className="input"
                placeholder="1234"
                value={dorsalInput}
                onChange={(e) => setDorsalInput(e.target.value)}
              />
              <button className="btn-primary w-full">
                <Plus className="h-4 w-4 mr-1.5" />
                Añadir a mi calendario
              </button>
              {dorsalInput && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-600" />
                  Dorsal guardado
                </p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
              <User className="h-3 w-3 inline mr-1" />
              {summary?.totalRatings ?? 0} corredores la han valorado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
