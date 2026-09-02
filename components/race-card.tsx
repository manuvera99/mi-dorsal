import Link from "next/link";
import { MapPin, Calendar, Mountain, ThumbsUp } from "lucide-react";
import { formatDate, formatProvince, formatRaceType } from "@/lib/utils";

interface RaceCardProps {
  race: any;
  showAverage?: boolean;
  avgGlobal?: number | null;
  totalRatings?: number;
  voteUps?: number;
  voteDowns?: number;
}

export function RaceCard({
  race,
  showAverage = false,
  avgGlobal,
  totalRatings,
  voteUps = 0,
  voteDowns = 0,
}: RaceCardProps) {
  const hasVotes = voteUps + voteDowns > 0;
  return (
    <Link
      href={`/carreras/${race.slug}`}
      className="card group flex flex-col gap-3 hover:border-runner-primary/50 relative"
    >
      {/* Indicador de votos en la esquina */}
      {hasVotes && (
        <div className="absolute top-3 right-3 flex items-center gap-0.5 text-xs font-medium text-gray-500 bg-white/80 backdrop-blur-sm rounded-full px-2 py-0.5 border border-gray-100">
          <ThumbsUp className="h-3 w-3 text-green-600" />
          <span>{voteUps - voteDowns}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 pr-12">
        <h3 className="font-semibold leading-tight group-hover:text-runner-primary transition-colors">
          {race.name}
        </h3>
        {showAverage && avgGlobal !== null && avgGlobal !== undefined && !hasVotes && (
          <span className="badge badge-red whitespace-nowrap">
            {avgGlobal.toFixed(1)} ★
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="badge badge-gray">{formatRaceType(race.raceType)}</span>
        {race.homologated && <span className="badge badge-green">Homologada</span>}
        {totalRatings !== undefined && totalRatings > 0 && (
          <span className="badge badge-gray">{totalRatings} votos</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          <span>{race.locality ?? "—"} · {formatProvince(race.province)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(race.startDate)} {race.startTime && `· ${race.startTime}h`}</span>
        </div>
        {race.elevationGainM !== undefined && race.elevationGainM > 0 && (
          <div className="flex items-center gap-1.5">
            <Mountain className="h-3.5 w-3.5" />
            <span>+{race.elevationGainM} m desnivel</span>
          </div>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-2xl font-bold text-runner-primary">
          {race.distanceKm.toFixed(race.distanceKm % 1 === 0 ? 0 : 1)}
          <span className="text-sm font-normal text-gray-500"> km</span>
        </span>
        {race.registrationUrl && (
          <span className="text-xs text-gray-400 group-hover:text-runner-primary transition-colors">
            Ver detalles →
          </span>
        )}
      </div>
    </Link>
  );
}
