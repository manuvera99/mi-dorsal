"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { formatDate, formatProvince, formatRaceType, formatTime } from "@/lib/utils";
import { RatingSliders } from "@/components/rating-sliders";
import { ThumbsVote } from "@/components/thumbs-vote";
import {
  MapPin, Calendar, Mountain, ExternalLink, FileText, Plus, Check, User,
  Globe, Mail, Phone, Clock, Users, Tag, Trophy, DollarSign, Share2,
  Instagram, Facebook, Twitter, Youtube, Award, AlertCircle, Download,
  Navigation, Car, ShowerHead, Shirt, Medal, Coffee, Camera, Heart,
  Activity, Timer, TrendingUp
} from "lucide-react";

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

const SERVICE_LABELS: Record<string, { label: string; icon: any }> = {
  showers: { label: "Duchas", icon: ShowerHead },
  changingRooms: { label: "Vestuarios", icon: Shirt },
  bagDrop: { label: "Guardarropa", icon: Check },
  parking: { label: "Parking", icon: Car },
  medical: { label: "Asistencia médica", icon: Activity },
  physiotherapy: { label: "Fisioterapia", icon: Heart },
  timingChip: { label: "Chip de tiempo", icon: Timer },
  photoService: { label: "Servicio de fotos", icon: Camera },
  videoService: { label: "Vídeo", icon: Camera },
  swagBag: { label: "Bolsa del corredor", icon: Award },
  tShirt: { label: "Camiseta", icon: Shirt },
  medal: { label: "Medalla finisher", icon: Medal },
  refreshments: { label: "Avituallamiento final", icon: Coffee },
};

function RaceDetailContent({ race, summary }: { race: any; summary: any }) {
  const [dorsalInput, setDorsalInput] = useState("");
  const [copied, setCopied] = useState(false);

  if (!race) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-gray-500">
        Cargando carrera…
      </div>
    );
  }

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSoldOut = race.soldOut;
  const regOpen = race.registrationOpenDate && new Date(race.registrationOpenDate) <= new Date();
  const regClosed = race.registrationCloseDate && new Date(race.registrationCloseDate) < new Date();
  const isRegistrationOpen = regOpen && !regClosed && !isSoldOut;

  return (
    <div className="bg-white">
      {/* ============== HERO CON CTAs VISIBLES ============== */}
      <div className="relative bg-gradient-to-br from-runner-primary to-red-700 text-white overflow-hidden">
        {race.imageUrl && (
          <div className="absolute inset-0 opacity-20">
            <img src={race.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 py-8 md:py-12">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              {formatRaceType(race.raceType)}
            </span>
            {race.homologated && (
              <span className="bg-green-500/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                <Award className="h-3 w-3" /> Homologada
              </span>
            )}
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              {formatProvince(race.province)}
            </span>
            {isSoldOut && (
              <span className="bg-red-900/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                ¡AGOTADA!
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-bold mb-2 leading-tight">
            {race.name}
          </h1>

          {/* Date & Location quick */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/90 mb-4 text-sm md:text-base">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {formatDate(race.startDate)} · {race.startTime}h
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {race.locality}
            </span>
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" /> {race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km
              {race.elevationGainM && race.elevationGainM > 0 && ` · +${race.elevationGainM}m`}
            </span>
          </div>

          {/* ============ CTAs BIEN VISIBLES ============ */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Inscribirse — primary */}
            {race.registrationUrl && (
              <a
                href={race.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 font-bold text-base px-8 py-4 rounded-lg transition-all shadow-lg ${
                  isSoldOut
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : isRegistrationOpen
                    ? "bg-white text-runner-primary hover:bg-yellow-50 hover:scale-105"
                    : "bg-yellow-400 text-gray-900 hover:bg-yellow-300 hover:scale-105"
                }`}
              >
                <Plus className="h-5 w-5" />
                {isSoldOut
                  ? "Inscripciones agotadas"
                  : isRegistrationOpen
                  ? "INSCRIBIRSE"
                  : "INSCRIPCIÓN PRÓXIMAMENTE"}
                {race.priceEur && !isSoldOut && (
                  <span className="ml-1 text-sm opacity-80">· {race.priceEur}€</span>
                )}
              </a>
            )}

            {/* Web oficial — secondary */}
            {race.officialUrl && (
              <a
                href={race.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 font-semibold text-base px-6 py-4 rounded-lg bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 transition-all"
              >
                <Globe className="h-5 w-5" />
                Web oficial
              </a>
            )}

            {/* Compartir */}
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 font-semibold text-base px-5 py-4 rounded-lg bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 transition-all"
              title="Compartir"
            >
              {copied ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
            </button>
          </div>

          {/* Info rápida de inscripción */}
          {race.registrationOpenDate && (
            <div className="mt-3 text-sm text-white/80 flex flex-wrap gap-x-4 gap-y-1">
              {isRegistrationOpen && race.registrationCloseDate && (
                <span>Inscripciones abiertas hasta el <strong>{formatDate(race.registrationCloseDate)}</strong></span>
              )}
              {!regOpen && race.registrationOpenDate && (
                <span>Apertura de inscripciones: <strong>{formatDate(race.registrationOpenDate)}</strong></span>
              )}
              {race.maxParticipants && (
                <span>Cupo: {race.maxParticipants.toLocaleString()} corredores</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============== CONTENIDO PRINCIPAL ============== */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ============== COLUMNA IZQUIERDA (2/3) ============== */}
          <div className="lg:col-span-2 space-y-8">
            {/* Descripción */}
            {race.description && (
              <section>
                <h2 className="text-xl font-bold mb-2">Sobre la carrera</h2>
                <p className="text-gray-700 leading-relaxed">{race.description}</p>
                {race.hashtags && race.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {race.hashtags.map((tag: string) => (
                      <span key={tag} className="text-xs text-runner-primary font-mono">#{tag.replace(/^#/, "")}</span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ============ DATOS CLAVE ============ */}
            <section>
              <h2 className="text-xl font-bold mb-4">Datos clave</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataItem icon={Calendar} label="Fecha" value={formatDate(race.startDate)} sub={race.startTime ? `${race.startTime}h` : undefined} />
                <DataItem icon={MapPin} label="Localidad" value={race.locality} sub={race.province && formatProvince(race.province)} />
                <DataItem icon={Trophy} label="Distancia" value={`${race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)} km`} sub={race.courseType && courseTypeLabel(race.courseType)} />
                <DataItem icon={Mountain} label="Desnivel" value={race.elevationGainM ? `+${race.elevationGainM} m` : "Plano"} sub={race.raceType === "trail" ? "Trail" : race.raceType === "road" ? "Asfalto" : "Mixto"} />
                <DataItem icon={DollarSign} label="Precio" value={race.priceEur ? `${race.priceEur} €` : "—"} sub="por dorsal" />
                <DataItem icon={Users} label="Cupo" value={race.maxParticipants?.toLocaleString() ?? "—"} sub="corredores máx." />
                <DataItem icon={Timer} label="Tiempo máx." value={race.timeLimitMinutes ? formatMinutes(race.timeLimitMinutes) : "—"} sub="para completar" />
                <DataItem icon={Tag} label="Chip" value={chipLabel(race.chipType)} sub="incluido" />
              </div>
            </section>

            {/* ============ INSCRIPCIÓN ============ */}
            {race.registrationUrl && (
              <section>
                <h2 className="text-xl font-bold mb-4">Inscripción</h2>
                <div className="card space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {race.registrationOpenDate && (
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wide">Apertura</div>
                        <div className="font-semibold">{formatDate(race.registrationOpenDate)}</div>
                      </div>
                    )}
                    {race.registrationCloseDate && (
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wide">Cierre</div>
                        <div className="font-semibold">{formatDate(race.registrationCloseDate)}</div>
                      </div>
                    )}
                    {race.maxParticipants && (
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wide">Cupo</div>
                        <div className="font-semibold">{race.maxParticipants.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                  {race.priceIncludes && (
                    <div>
                      <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Incluye</div>
                      <p className="text-sm text-gray-700">{race.priceIncludes}</p>
                    </div>
                  )}
                  <a
                    href={race.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex w-full sm:w-auto justify-center"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Ir a la página de inscripción
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </a>
                </div>
              </section>
            )}

            {/* ============ LUGAR DE SALIDA ============ */}
            {(race.venue || race.address) && (
              <section>
                <h2 className="text-xl font-bold mb-4">Lugar</h2>
                <div className="card space-y-2">
                  {race.venue && (
                    <div className="font-semibold text-lg">{race.venue}</div>
                  )}
                  {race.address && (
                    <div className="text-sm text-gray-600 flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                      <span>{race.address}</span>
                    </div>
                  )}
                  {race.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(race.address + ", " + race.locality)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-sm inline-flex mt-2"
                    >
                      <Navigation className="h-3.5 w-3.5 mr-1.5" /> Cómo llegar
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* ============ RECORRIDO ============ */}
            {(race.gpxUrl || race.courseType || race.cutoffs) && (
              <section>
                <h2 className="text-xl font-bold mb-4">Recorrido</h2>
                <div className="card space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    {race.courseType && (
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wide">Tipo</div>
                        <div className="font-semibold">{courseTypeLabel(race.courseType)}</div>
                      </div>
                    )}
                    {race.distanceKm && (
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wide">Distancia</div>
                        <div className="font-semibold">{race.distanceKm.toFixed(2)} km</div>
                      </div>
                    )}
                    {race.elevationGainM !== undefined && (
                      <div>
                        <div className="text-gray-500 text-xs uppercase tracking-wide">Desnivel +</div>
                        <div className="font-semibold">+{race.elevationGainM} m</div>
                      </div>
                    )}
                  </div>

                  {race.cutoffs && race.cutoffs.length > 0 && (
                    <div>
                      <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Tiempos de corte</div>
                      <ul className="text-sm space-y-1">
                        {race.cutoffs.map((c: any, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            <span>Km {c.km} — hasta las <strong>{c.timeLimit}h</strong></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    {race.gpxUrl && (
                      <a href={race.gpxUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar track GPX
                      </a>
                    )}
                    {race.mapImageUrl && (
                      <a href={race.mapImageUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                        <MapPin className="h-3.5 w-3.5 mr-1.5" /> Ver mapa
                      </a>
                    )}
                    {race.profileImageUrl && (
                      <a href={race.profileImageUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Ver perfil
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ============ CATEGORÍAS ============ */}
            {race.categories && race.categories.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4">Categorías</h2>
                <div className="card">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {race.categories.map((cat: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        {cat.gender === "M" && <span className="text-blue-600 font-bold">♂</span>}
                        {cat.gender === "F" && <span className="text-pink-600 font-bold">♀</span>}
                        {(!cat.gender || cat.gender === "mixto") && <span className="text-gray-600 font-bold">⚥</span>}
                        <div>
                          <div className="font-semibold">{cat.name}</div>
                          {cat.ageMin && cat.ageMax && (
                            <div className="text-xs text-gray-500">{cat.ageMin}-{cat.ageMax} años</div>
                          )}
                          {cat.ageMin && !cat.ageMax && (
                            <div className="text-xs text-gray-500">≥ {cat.ageMin} años</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ============ SERVICIOS ============ */}
            {race.services && (
              <section>
                <h2 className="text-xl font-bold mb-4">Servicios incluidos</h2>
                <div className="card">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                    {Object.entries(race.services).map(([key, value]) => {
                      if (key === "aidStations" && value) {
                        return (
                          <div key={key} className="flex items-center gap-2 p-2 bg-green-50 rounded text-green-800">
                            <Coffee className="h-4 w-4" />
                            <span><strong>{value as number}</strong> avituallamientos</span>
                          </div>
                        );
                      }
                      if (typeof value === "boolean" && value) {
                        const meta = SERVICE_LABELS[key];
                        if (!meta) return null;
                        const Icon = meta.icon;
                        return (
                          <div key={key} className="flex items-center gap-2 p-2 bg-green-50 rounded text-green-800">
                            <Icon className="h-4 w-4" />
                            <span>{meta.label}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ============ PREMIOS ============ */}
            {race.prizes && (
              <section>
                <h2 className="text-xl font-bold mb-4">Premios</h2>
                <div className="card">
                  <p className="text-sm text-gray-700">{race.prizes}</p>
                </div>
              </section>
            )}

            {/* ============ ORGANIZADOR ============ */}
            {(race.organizer || race.contactEmail || race.contactPhone) && (
              <section>
                <h2 className="text-xl font-bold mb-4">Organización</h2>
                <div className="card space-y-2 text-sm">
                  {race.organizer && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="font-semibold">{race.organizer}</span>
                      {race.organizerUrl && (
                        <a href={race.organizerUrl} target="_blank" rel="noopener noreferrer" className="text-runner-primary hover:underline text-xs">
                          <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      )}
                    </div>
                  )}
                  {race.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <a href={`mailto:${race.contactEmail}`} className="text-runner-primary hover:underline">{race.contactEmail}</a>
                    </div>
                  )}
                  {race.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <a href={`tel:${race.contactPhone.replace(/\s/g, "")}`} className="hover:underline">{race.contactPhone}</a>
                    </div>
                  )}
                  {/* Redes sociales */}
                  {(race.socialInstagram || race.socialFacebook || race.socialTwitter || race.socialYoutube || race.socialStrava) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {race.socialInstagram && (
                        <a href={race.socialInstagram} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                          <Instagram className="h-3.5 w-3.5 mr-1" /> Instagram
                        </a>
                      )}
                      {race.socialFacebook && (
                        <a href={race.socialFacebook} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                          <Facebook className="h-3.5 w-3.5 mr-1" /> Facebook
                        </a>
                      )}
                      {race.socialTwitter && (
                        <a href={race.socialTwitter} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                          <Twitter className="h-3.5 w-3.5 mr-1" /> X
                        </a>
                      )}
                      {race.socialYoutube && (
                        <a href={race.socialYoutube} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                          <Youtube className="h-3.5 w-3.5 mr-1" /> YouTube
                        </a>
                      )}
                      {race.socialStrava && (
                        <a href={race.socialStrava} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                          <Activity className="h-3.5 w-3.5 mr-1" /> Strava
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============ REGLAMENTO Y RESULTADOS ============ */}
            {(race.rulesUrl || race.resultsUrl) && (
              <section>
                <h2 className="text-xl font-bold mb-4">Documentos y resultados</h2>
                <div className="card">
                  <div className="flex flex-wrap gap-2">
                    {race.rulesUrl && (
                      <a href={race.rulesUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Reglamento
                      </a>
                    )}
                    {race.resultsUrl && (
                      <a href={race.resultsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                        <Trophy className="h-3.5 w-3.5 mr-1.5" /> Resultados
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ============ VALORACIONES ============ */}
            {summary && summary.totalRatings > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4">Valoraciones de la comunidad</h2>
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl font-bold text-runner-primary">
                        {summary.avgGlobal?.toFixed(2)}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">/ 10 media</div>
                        <div className="text-xs text-gray-500">
                          {summary.totalRatings} {summary.totalRatings === 1 ? "voto" : "votos"}
                        </div>
                      </div>
                    </div>
                    <ThumbsVote raceId={race._id} size="lg" showLoginPrompt={false} />
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    <strong>¿La recomiendas?</strong> Pulsa 👍 para decir que sí, 👎 si no.
                    Solo los usuarios registrados pueden votar.
                  </p>
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
                            <div className="h-full bg-runner-primary" style={{ width: `${val * 10}%` }} />
                          </div>
                          <div className="w-10 text-right font-mono font-bold">{val.toFixed(1)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ============ FORMULARIO DE VALORACIÓN ============ */}
            <RatingSliders raceId={race._id} />
          </div>

          {/* ============== SIDEBAR STICKY ============== */}
          <div className="space-y-4">
            <div className="sticky top-20 space-y-4">
              {/* Añadir a mi calendario */}
              <div className="card">
                <h3 className="font-semibold mb-2">¿Vas a correrla?</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Añádela a tu calendario y te predecimos tu tiempo.
                  Te llegará el resultado oficial por email.
                </p>
                <div className="space-y-2">
                  <label className="label">Tu dorsal (si ya inscrito)</label>
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
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <User className="h-3 w-3 inline mr-1" />
                  {summary?.totalRatings ?? 0} corredores la han valorado
                </div>
              </div>

              {/* Mini CTAs sidebar */}
              <div className="card space-y-2">
                {race.registrationUrl && (
                  <a
                    href={race.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full justify-center"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Inscribirse
                    {race.priceEur && <span className="ml-1 text-sm">· {race.priceEur}€</span>}
                  </a>
                )}
                {race.officialUrl && (
                  <a
                    href={race.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full justify-center"
                  >
                    <Globe className="h-4 w-4 mr-1.5" /> Web oficial
                  </a>
                )}
                {race.resultsUrl && (
                  <a
                    href={race.resultsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full justify-center"
                  >
                    <Trophy className="h-4 w-4 mr-1.5" /> Resultados
                  </a>
                )}
                {/* Thumbs en sidebar siempre visible */}
                <div className="pt-3 mt-1 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-2 text-center">
                    ¿La recomiendas?
                  </div>
                  <div className="flex justify-center">
                    <ThumbsVote raceId={race._id} size="md" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Helper components
// =============================================================================

function DataItem({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="card !p-4">
      <Icon className="h-4 w-4 text-gray-400 mb-1" />
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="font-bold text-base">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function chipLabel(chipType: string | undefined): string {
  if (chipType === "disposable_chip") return "Chip desechable";
  if (chipType === "chip") return "Chip propio";
  if (chipType === "manual") return "Manual";
  return "—";
}

function courseTypeLabel(type: string): string {
  if (type === "loop") return "Circular";
  if (type === "point_to_point") return "Punto a punto";
  if (type === "out_and_back") return "Ida y vuelta";
  return type;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
