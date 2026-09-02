"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi, isMockMode } from "@/lib/mock/provider";
import { formatDate, formatTime } from "@/lib/utils";
import { Calendar, MapPin, Trophy, Plus } from "lucide-react";
import Link from "next/link";

function MockCalendario() {
  const [myRaces, setMyRaces] = useState<any[]>([]);
  useEffect(() => {
    mockApi.myRaces.listMine().then((r) => setMyRaces(r as any));
  }, []);
  return <CalendarioContent myRaces={myRaces} />;
}

function RealCalendario() {
  const convexMyRaces = useQuery(api.myRaces.listMine, {});
  return <CalendarioContent myRaces={(convexMyRaces as any) ?? []} />;
}

export default function CalendarioPage() {
  const useMock = isMockMode();
  return useMock ? <MockCalendario /> : <RealCalendario />;
}

function CalendarioContent({ myRaces }: { myRaces: any[] }) {

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Mi calendario</h1>
          <p className="text-gray-600">
            {myRaces.length} {myRaces.length === 1 ? "carrera planeada" : "carreras planeadas"}
          </p>
        </div>
        <Link href="/carreras" className="btn-primary">
          <Plus className="h-4 w-4 mr-1.5" /> Añadir carrera
        </Link>
      </div>

      {myRaces.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold mb-2">Tu calendario está vacío</h3>
          <p className="text-sm text-gray-600 mb-4">
            Explora el catálogo y añade las carreras que quieras correr esta temporada.
          </p>
          <Link href="/carreras" className="btn-primary inline-flex">
            Ver carreras
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {myRaces.map((mr) => (
            <div key={mr._id} className="card flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {mr.race && (
                    <Link
                      href={`/carreras/${mr.race.slug}`}
                      className="font-semibold text-lg hover:text-runner-primary"
                    >
                      {mr.race.name}
                    </Link>
                  )}
                  {mr.dorsalNumber && (
                    <span className="badge badge-gray">#{mr.dorsalNumber}</span>
                  )}
                  <span className={`badge ${mr.status === "planned" ? "badge-red" : "badge-green"}`}>
                    {mr.status === "planned" ? "Planeada" : mr.status === "done" ? "Hecha" : "DNS/DNF"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  {mr.race?.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(mr.race.startDate)}
                    </span>
                  )}
                  {mr.race?.locality && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {mr.race.locality}
                    </span>
                  )}
                  {mr.race && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5" />
                      {mr.race.distanceKm.toFixed(mr.race.distanceKm % 1 === 0 ? 0 : 1)} km
                    </span>
                  )}
                </div>
              </div>

              <div className="md:text-right">
                {mr.predictedTimeSeconds && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Estimación</div>
                    <div className="text-2xl font-bold text-runner-primary font-mono">
                      {formatTime(mr.predictedTimeSeconds)}
                    </div>
                    {mr.predictionConfidence && (
                      <div className="text-xs text-gray-500">
                        Confianza {mr.predictionConfidence === "high" ? "alta" : mr.predictionConfidence === "medium" ? "media" : "baja"}
                      </div>
                    )}
                  </div>
                )}
                {mr.actualTimeSeconds && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Tiempo oficial</div>
                    <div className="text-2xl font-bold text-runner-accent font-mono">
                      {formatTime(mr.actualTimeSeconds)}
                    </div>
                    {mr.actualPosition && (
                      <div className="text-xs text-gray-500">
                        Posición #{mr.actualPosition}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
