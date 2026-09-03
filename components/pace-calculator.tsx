"use client";

/**
 * Calculadora de ritmos con altimetría — versión interactiva.
 *
 * Features:
 *  - Perfil de altimetría (real de la BBDD o sintético triangular)
 *  - Gráfico combinado: altimetría (bar) + pace por km (línea)
 *  - **DRAG VERTICAL** de los puntos rojos del pace, con **snap a 5s**
 *  - Botón "Auto-ajuste" para que el pace siga la pendiente Minetti
 *  - Botón "Perfil real/sintético" si hay altimetría extraída
 *  - **DESCARGA** del plan como TCX (workout Garmin Connect) o CSV (splits)
 *
 * Fórmula de ajuste por pendiente (aproximación Minetti):
 *   - Subida: pace * (1 + 0.04 * slope_pct)   (≈ 4% más lento por 1% de pendiente)
 *   - Bajada: pace * (1 - 0.025 * |slope_pct|) (≈ 2.5% más rápido por 1% de bajada)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Activity, RotateCcw, Sliders, Mountain, ArrowUp, ArrowDown,
  Download, FileText, ChevronDown, GripVertical, Sparkles,
} from "lucide-react";
import {
  downloadTcx, downloadCsv, computePlanStats, type PacePlan,
} from "@/lib/pace-export";

type AltimetryPoint = { km: number; altitudeM: number };
type PacePoint = { km: number; altitudeM: number; paceSeconds: number; splitSeconds: number };

const DEFAULT_BASE_PACE = 5 * 60 + 30; // 5:30/km
const SNAP_SECONDS = 5; // snap a 5s
const PACE_MIN = 3 * 60;     // 3:00/km (pace mínimo)
const PACE_MAX = 12 * 60;    // 12:00/km (pace máximo para ultra lento)
const CHART_HEIGHT = 280;    // px — debe coincidir con ResponsiveContainer

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parsePaceInput(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [m, sec] = trimmed.split(":").map(Number);
    return m * 60 + sec;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [h, m, s2] = trimmed.split(":").map(Number);
    return h * 3600 + m * 60 + s2;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n > 60) return n;
    return n * 60;
  }
  return null;
}

function paceToString(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function snapPace(seconds: number): number {
  return Math.round(seconds / SNAP_SECONDS) * SNAP_SECONDS;
}

function generateSyntheticProfile(distanceKm: number, elevationGainM: number): AltimetryPoint[] {
  const points: AltimetryPoint[] = [];
  const kmCount = Math.max(2, Math.ceil(distanceKm));
  const peakKm = kmCount / 2;
  for (let i = 0; i <= kmCount; i++) {
    const km = i;
    let altitude: number;
    if (km <= peakKm) {
      const t = km / peakKm;
      altitude = elevationGainM * t;
    } else {
      const t = (km - peakKm) / (kmCount - peakKm);
      altitude = elevationGainM * (1 - t);
    }
    points.push({ km, altitudeM: Math.round(altitude) });
  }
  return points;
}

function adjustPaceBySlope(basePace: number, slopePct: number): number {
  if (slopePct > 0) return basePace * (1 + 0.04 * slopePct);
  return basePace * (1 - 0.025 * Math.abs(slopePct));
}

function accumulateUpTo(paces: number[], i: number): number {
  let s = 0;
  for (let k = 0; k <= i; k++) s += paces[k] ?? 0;
  return s;
}

function computePaces(
  basePace: number,
  profile: AltimetryPoint[],
  autoAdjust: boolean,
  useProfile: boolean,
  currentPaces: number[],
): number[] {
  const result: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const prevAlt = i === 0 ? profile[0].altitudeM : profile[i].altitudeM;
    const nextAlt = profile[i + 1].altitudeM;
    const gain = nextAlt - prevAlt;
    const slopePct = gain;
    if (autoAdjust && useProfile) {
      result.push(snapPace(adjustPaceBySlope(basePace, slopePct)));
    } else {
      const existing = currentPaces[i];
      result.push(existing && existing > 0 ? existing : basePace);
    }
  }
  return result;
}

// =============================================================================
// Custom Dot arrastrable con cursor y snap a 5s
// =============================================================================

interface DraggableDotProps {
  cx?: number;
  cy?: number;
  index: number;
  isActive: boolean;
  isAutoAdjusted: boolean;
  chartRef: React.RefObject<HTMLDivElement | null>;
  paceMin: number;
  paceMax: number;
  onDragStart: (i: number) => void;
  onDragMove: (i: number, newPace: number) => void;
  onDragEnd: () => void;
}

function DraggableDot(props: DraggableDotProps) {
  const { cx, cy, index, isActive, isAutoAdjusted } = props;
  if (cx === undefined || cy === undefined) return null;

  const fill = isActive ? "#dc2626" : isAutoAdjusted ? "#f97316" : "#dc2626";
  const r = isActive ? 8 : 5;
  const stroke = isActive ? "#7f1d1d" : "#fff";
  const strokeWidth = isActive ? 2 : 1.5;
  const cursor = isActive ? "grabbing" : "grab";

  return (
    <g style={{ cursor }}>
      {/* Halo invisible más grande para mejor hit area */}
      <circle
        cx={cx}
        cy={cy}
        r={14}
        fill="transparent"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onDragStart(index);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onDragStart(index);
        }}
        style={{ cursor: "grab" }}
      />
      {/* Dot visual */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={{ pointerEvents: "none", transition: "r 0.1s" }}
      />
      {isActive && (
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          fill="#dc2626"
          fontSize={10}
          fontWeight="bold"
          style={{ pointerEvents: "none" }}
        >
          ⬍ arrastra
        </text>
      )}
    </g>
  );
}

// =============================================================================
// Componente principal
// =============================================================================

export function PaceCalculator({
  raceName,
  distanceKm,
  elevationGainM,
  altimetryData,
}: {
  raceName?: string;
  distanceKm: number;
  elevationGainM?: number;
  altimetryData?: AltimetryPoint[];
}) {
  const profile = useMemo<AltimetryPoint[]>(() => {
    if (altimetryData && altimetryData.length > 1) return altimetryData;
    if (elevationGainM && elevationGainM > 0) return generateSyntheticProfile(distanceKm, elevationGainM);
    const points: AltimetryPoint[] = [];
    for (let i = 0; i <= Math.ceil(distanceKm); i++) points.push({ km: i, altitudeM: 0 });
    return points;
  }, [altimetryData, elevationGainM, distanceKm]);

  const kmCount = profile.length - 1;
  const hasRealAltimetry = !!(altimetryData && altimetryData.length > 1);

  const [paces, setPaces] = useState<number[]>([]);
  const [basePaceStr, setBasePaceStr] = useState(paceToString(DEFAULT_BASE_PACE));
  const [autoAdjust, setAutoAdjust] = useState(true);
  const [useProfile, setUseProfile] = useState(hasRealAltimetry);
  const [draggingKm, setDraggingKm] = useState<number | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newPaces = computePaces(DEFAULT_BASE_PACE, profile, autoAdjust, useProfile, paces);
    setPaces(newPaces);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmCount, autoAdjust, useProfile]);

  const chartData = useMemo<PacePoint[]>(() => {
    if (paces.length === 0) return [];
    return profile.slice(1).map((p, i) => {
      const prevAlt = i === 0 ? profile[0].altitudeM : profile[i].altitudeM;
      const altitude = (prevAlt + p.altitudeM) / 2;
      const pace = paces[i] ?? DEFAULT_BASE_PACE;
      return {
        km: i + 1,
        altitudeM: Math.round(altitude),
        paceSeconds: Math.round(pace),
        splitSeconds: Math.round(pace),
      };
    });
  }, [profile, paces]);

  const totalSeconds = useMemo(() => paces.reduce((sum, p) => sum + p, 0), [paces]);
  const avgPace = paces.length > 0 ? totalSeconds / paces.length : 0;
  const minAlt = Math.min(...chartData.map((d) => d.altitudeM), 0);
  const maxAlt = Math.max(...chartData.map((d) => d.altitudeM), 0);
  const yAxisDomain: [number, number] = [Math.min(0, minAlt - 10), maxAlt + 10];

  // Pace range para el eje Y derecho (pace line)
  const paceValues = chartData.map((d) => d.paceSeconds);
  const paceMin = Math.max(PACE_MIN, Math.floor((Math.min(...paceValues) - 60) / 30) * 30);
  const paceMax = Math.min(PACE_MAX, Math.ceil((Math.max(...paceValues) + 60) / 30) * 30);
  const paceDomain: [number, number] = [paceMin, paceMax];

  const updatePace = (i: number, seconds: number) => {
    setPaces((prev) => {
      const next = [...prev];
      next[i] = seconds;
      return next;
    });
  };

  const applyBasePace = (input: string) => {
    setBasePaceStr(input);
    const sec = parsePaceInput(input);
    if (sec && sec > 60) {
      const newPaces = computePaces(sec, profile, autoAdjust, useProfile, paces);
      setPaces(newPaces);
    }
  };

  const resetToBase = () => {
    const sec = parsePaceInput(basePaceStr) ?? DEFAULT_BASE_PACE;
    const newPaces = computePaces(sec, profile, autoAdjust, useProfile, []);
    setPaces(newPaces);
  };

  const toggleAuto = () => {
    const newAuto = !autoAdjust;
    setAutoAdjust(newAuto);
    if (newAuto) {
      const sec = parsePaceInput(basePaceStr) ?? DEFAULT_BASE_PACE;
      const newPaces = computePaces(sec, profile, true, useProfile, []);
      setPaces(newPaces);
    }
  };

  const toggleProfile = () => {
    const newUse = !useProfile;
    setUseProfile(newUse);
    const sec = parsePaceInput(basePaceStr) ?? DEFAULT_BASE_PACE;
    if (newUse && altimetryData && altimetryData.length > 1) {
      const newPaces = computePaces(sec, altimetryData, autoAdjust, true, []);
      setPaces(newPaces);
    } else if (!newUse && elevationGainM && elevationGainM > 0) {
      const synthetic = generateSyntheticProfile(distanceKm, elevationGainM);
      const newPaces = computePaces(sec, synthetic, autoAdjust, false, []);
      setPaces(newPaces);
    } else {
      const newPaces = computePaces(sec, profile, autoAdjust, newUse, []);
      setPaces(newPaces);
    }
  };

  // =====================================================================
  // Lógica de drag — convierte Y del ratón a pace y aplica snap a 5s
  // =====================================================================
  const handleDragStart = useCallback((i: number) => {
    setDraggingKm(i);
  }, []);

  const handleDragMove = useCallback((i: number, newPace: number) => {
    setPaces((prev) => {
      const next = [...prev];
      next[i] = snapPace(Math.max(PACE_MIN, Math.min(PACE_MAX, newPace)));
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingKm(null);
  }, []);

  // Listeners globales de mousemove/mouseup cuando hay un dot activo
  useEffect(() => {
    if (draggingKm === null) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      // Estimación del plot area (descontamos el header del chart)
      // Recharts tiene un padding interno; estimamos top/bottom del área de plot
      const plotTop = rect.top + 20;     // margen superior del chart
      const plotBottom = rect.top + CHART_HEIGHT - 30; // margen inferior
      const yMouse = e.clientY;
      if (yMouse < plotTop || yMouse > plotBottom) return;
      // Mapear Y a pace (invertido: top = paceMax, bottom = paceMin)
      const ratio = (yMouse - plotTop) / (plotBottom - plotTop);
      const newPace = paceMax - ratio * (paceMax - paceMin);
      handleDragMove(draggingKm, newPace);
    };

    const onMouseUp = () => {
      handleDragEnd();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMouseMove(e.touches[0] as any);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onMouseUp);
    };
  }, [draggingKm, paceMin, paceMax, handleDragMove, handleDragEnd]);

  // =====================================================================
  // Helpers de descarga
  // =====================================================================
  const buildPlan = (): PacePlan => ({
    name: raceName ?? `Plan ${distanceKm.toFixed(1)}K`,
    distanceKm,
    paces: paces.map((p) => Math.round(p)),
    altitudes: chartData.map((d) => d.altitudeM),
    targetDate: undefined,
  });

  const handleDownloadTcx = () => {
    downloadTcx(buildPlan());
    setShowDownloadMenu(false);
  };

  const handleDownloadCsv = () => {
    downloadCsv(buildPlan());
    setShowDownloadMenu(false);
  };

  if (paces.length === 0) {
    return (
      <section>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Activity className="h-5 w-5 text-runner-primary" />
          Calculadora de ritmos
        </h2>
        <div className="card text-gray-500">Cargando…</div>
      </section>
    );
  }

  const stats = computePlanStats(buildPlan());
  const paceDiff = stats.slowestKm - stats.fastestKm;
  const hasManualEdits = paces.some((p, i) => {
    if (!autoAdjust) return true;
    const prevAlt = i === 0 ? profile[0].altitudeM : profile[i].altitudeM;
    const nextAlt = profile[i + 1].altitudeM;
    const slopePct = nextAlt - prevAlt;
    const expected = snapPace(adjustPaceBySlope(parsePaceInput(basePaceStr) ?? DEFAULT_BASE_PACE, slopePct));
    return Math.abs(p - expected) > SNAP_SECONDS;
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-runner-primary" />
          Calculadora de ritmos
        </h2>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <button
            onClick={toggleProfile}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              useProfile && hasRealAltimetry
                ? "bg-runner-primary text-white border-runner-primary"
                : "bg-white text-gray-600 border-gray-300 hover:border-runner-primary"
            }`}
            disabled={!hasRealAltimetry && (!elevationGainM || elevationGainM === 0)}
            title={hasRealAltimetry ? "Usar altimetría real (extraída)" : "Usar perfil sintético (basado en ganancia total)"}
          >
            <Mountain className="inline h-3.5 w-3.5 mr-1" />
            {hasRealAltimetry ? "Perfil real" : "Perfil sintético"}
          </button>
          <button
            onClick={toggleAuto}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              autoAdjust
                ? "bg-runner-primary text-white border-runner-primary"
                : "bg-white text-gray-600 border-gray-300 hover:border-runner-primary"
            }`}
          >
            <Sliders className="inline h-3.5 w-3.5 mr-1" />
            {autoAdjust ? "Auto-ajuste ON" : "Manual"}
          </button>

          {/* Menú de descarga */}
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border bg-runner-primary text-white border-runner-primary hover:opacity-90 flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar Garmin
              <ChevronDown className="h-3 w-3" />
            </button>
            {showDownloadMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDownloadMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={handleDownloadTcx}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2 border-b"
                  >
                    <FileText className="h-4 w-4 text-runner-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">TCX (workout Garmin)</div>
                      <div className="text-xs text-gray-500">Importable en Garmin Connect → Entrenamientos</div>
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadCsv}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2"
                  >
                    <FileText className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">CSV (splits)</div>
                      <div className="text-xs text-gray-500">Universal — Excel, Google Sheets, manual</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card space-y-5">
        {/* ============ CONTROLES PRINCIPALES ============ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Ritmo base (s/km)</label>
            <input
              type="text"
              value={basePaceStr}
              onChange={(e) => applyBasePace(e.target.value)}
              placeholder="5:30"
              className="input font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Tiempo total</label>
            <div className="input font-mono font-bold text-2xl text-runner-primary">
              {formatTime(totalSeconds)}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Ritmo medio</label>
            <div className="input font-mono font-bold text-2xl">{paceToString(avgPace)}/km</div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Distancia</label>
            <div className="input font-mono text-lg">
              {distanceKm.toFixed(2)} km
              {elevationGainM ? <span className="text-sm text-gray-500 ml-1">+{elevationGainM}m</span> : null}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Rango paces</label>
            <div className="input font-mono text-base">
              {paceToString(stats.fastestKm)}–{paceToString(stats.slowestKm)}
              <span className="text-xs text-gray-500 ml-1">({paceDiff}s)</span>
            </div>
          </div>
        </div>

        {/* ============ INSTRUCCIONES DE DRAG ============ */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 text-xs text-blue-900 flex items-center gap-2">
          <GripVertical className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Arrastra los puntos rojos arriba/abajo</strong> para ajustar el pace de cada km (snap a {SNAP_SECONDS}s).
            {hasManualEdits && autoAdjust && (
              <> · Tienes <strong>ajustes manuales</strong> — desactiva auto-ajuste para mantenerlos.</>
            )}
            {!autoAdjust && (
              <> · Modo <strong>manual</strong> activo: tus cambios se preservan.</>
            )}
          </span>
        </div>

        {/* ============ GRÁFICO ALTIMETRÍA + RITMO ============ */}
        <div className="bg-gray-50 rounded-md p-3" ref={chartRef}>
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-gradient-to-t from-green-200 to-green-500 rounded-sm" />
              Altimetría (m)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-red-600" />
              Ritmo por km (s) — arrastrable
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              Auto-ajuste pendiente
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
              Manual / drag
            </span>
          </div>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              onMouseLeave={handleDragEnd}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="km"
                tick={{ fontSize: 11 }}
                label={{ value: "km", position: "insideBottom", offset: -2, fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                domain={yAxisDomain}
                tick={{ fontSize: 10 }}
                width={45}
                label={{ value: "m", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={paceDomain}
                tick={{ fontSize: 10 }}
                width={45}
                tickFormatter={(v) => paceToString(v)}
                label={{ value: "s/km", angle: 90, position: "insideRight", fontSize: 10 }}
                reversed
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === "Altitud") return [`${value} m`, "Altitud"];
                  if (name === "Ritmo") return [paceToString(Number(value)) + "/km", "Ritmo"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Km ${label}`}
              />
              <Bar yAxisId="left" dataKey="altitudeM" fill="#22c55e" opacity={0.4} name="Altitud" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="paceSeconds"
                stroke="#dc2626"
                strokeWidth={2.5}
                name="Ritmo"
                dot={(dotProps: any) => {
                  const i = (dotProps.payload?.km ?? 1) - 1;
                  return (
                    <DraggableDot
                      {...dotProps}
                      index={i}
                      isActive={draggingKm === i}
                      isAutoAdjusted={autoAdjust && useProfile}
                      chartRef={chartRef}
                      paceMin={paceMin}
                      paceMax={paceMax}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                    />
                  );
                }}
                activeDot={false}
              />
              {chartData.length > 0 && (
                <ReferenceLine
                  yAxisId="right"
                  y={avgPace}
                  stroke="#6b7280"
                  strokeDasharray="4 4"
                  label={{ value: `Media ${paceToString(avgPace)}`, fontSize: 9, position: "insideTopRight" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ============ TABLA EDITABLE POR KM ============ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Ritmo por kilómetro</h3>
            <button
              onClick={resetToBase}
              className="text-xs text-runner-primary hover:underline flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-1.5 pr-2">Km</th>
                  <th className="text-right py-1.5 px-2">Altitud</th>
                  <th className="text-right py-1.5 px-2">Pendiente</th>
                  <th className="text-right py-1.5 px-2">Ritmo (s/km)</th>
                  <th className="text-right py-1.5 px-2">vs Media</th>
                  <th className="text-right py-1.5 pl-2">Split parcial</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chartData.map((d, i) => {
                  const prevAlt = i === 0 ? profile[0].altitudeM : profile[i].altitudeM;
                  const slopePct = d.altitudeM - prevAlt;
                  const vsAvg = d.paceSeconds - avgPace;
                  return (
                    <tr key={d.km} className={`hover:bg-gray-50 ${draggingKm === i ? "bg-red-50" : ""}`}>
                      <td className="py-1.5 pr-2 font-mono font-bold">
                        {d.km}
                        {draggingKm === i && <span className="ml-1 text-red-600">⬍</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-700">
                        {d.altitudeM} m
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs">
                        {slopePct === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : slopePct > 0 ? (
                          <span className="text-red-600 flex items-center justify-end gap-0.5">
                            <ArrowUp className="h-3 w-3" />+{slopePct}m
                          </span>
                        ) : (
                          <span className="text-green-600 flex items-center justify-end gap-0.5">
                            <ArrowDown className="h-3 w-3" />{slopePct}m
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="text"
                          value={paceToString(d.paceSeconds)}
                          onChange={(e) => {
                            const sec = parsePaceInput(e.target.value);
                            if (sec) updatePace(i, snapPace(sec));
                          }}
                          className="w-20 text-right font-mono text-sm border border-gray-300 rounded px-1.5 py-0.5 focus:border-runner-primary focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs">
                        {Math.abs(vsAvg) < 1 ? (
                          <span className="text-gray-400">media</span>
                        ) : vsAvg > 0 ? (
                          <span className="text-red-600">+{Math.round(vsAvg)}s</span>
                        ) : (
                          <span className="text-green-600">{Math.round(vsAvg)}s</span>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right font-mono text-gray-700">
                        {formatTime(accumulateUpTo(paces, i))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 font-bold">
                <tr>
                  <td className="py-2 pr-2">Total</td>
                  <td colSpan={2}></td>
                  <td className="py-2 px-2 text-right font-mono">{paceToString(avgPace)}/km</td>
                  <td></td>
                  <td className="py-2 pl-2 text-right font-mono text-runner-primary text-base">
                    {formatTime(totalSeconds)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ============ NOTAS ============ */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 space-y-1">
          <p>
            <strong>Cómo funciona:</strong> El ritmo se ajusta automáticamente por la pendiente
            del km (≈ 4% más lento en subida por cada 1% de desnivel, ≈ 2.5% más rápido en bajada).
          </p>
          <p>
            <strong>Drag & drop:</strong> mantén pulsado un punto rojo y muévelo arriba (más rápido) o abajo (más lento).
            El pace se redondea a múltiplos de {SNAP_SECONDS} segundos. Compatible con ratón y táctil.
          </p>
          <p>
            <strong>Garmin:</strong> descarga el TCX y súbelo a Garmin Connect (Entrenamientos → Importar).
            Cada km se convierte en un step con pace target. Sincroniza con tu dispositivo y listo.
          </p>
        </div>
      </div>
    </section>
  );
}
