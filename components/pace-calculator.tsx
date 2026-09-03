"use client";

/**
 * Calculadora de ritmos con altimetría.
 *
 * Inputs:
 *  - distanceKm: distancia total de la carrera
 *  - elevationGainM: desnivel + total (fallback si no hay altimetryData)
 *  - altimetryData: array opcional de {km, altitudeM} per-km
 *
 * Comportamiento:
 *  - Si altimetryData está, se muestra con esos datos exactos.
 *  - Si no, generamos un perfil sintético (subida gradual hasta mitad, bajada después).
 *  - Usuario pone un ritmo base (s/km). Cada km se ajusta automáticamente por pendiente
 *    usando una fórmula Minetti simplificada.
 *  - Usuario puede sobreescribir el ritmo de cualquier km individualmente.
 *  - El gráfico muestra altimetría de fondo + línea de ritmo por km.
 *
 * Fórmula de ajuste por pendiente (aproximación Minetti):
 *   - Subida: pace * (1 + 0.04 * slope_pct)   (≈ 4% más lento por 1% de pendiente)
 *   - Bajada: pace * (1 - 0.025 * |slope_pct|) (≈ 2.5% más rápido por 1% de bajada)
 *   - slope_pct = (altitude[i] - altitude[i-1]) / 10  (% de pendiente por km)
 *
 * Estas constantes son aproximadas. Un usuario experto puede sobrescribir cualquier km.
 */

import { useState, useMemo, useEffect } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Activity, RotateCcw, Sliders, TrendingUp, Clock, Mountain, ArrowUp, ArrowDown } from "lucide-react";

type AltimetryPoint = { km: number; altitudeM: number };
type PacePoint = { km: number; altitudeM: number; paceSeconds: number; splitSeconds: number };

const DEFAULT_BASE_PACE = 5 * 60 + 30; // 5:30/km por defecto

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parsePaceInput(s: string): number | null {
  // Acepta "5:30", "5.30" (minutos.decimales), "330" (segundos), "5:30:00"
  const trimmed = s.trim();
  if (!trimmed) return null;
  // mm:ss
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [m, sec] = trimmed.split(":").map(Number);
    return m * 60 + sec;
  }
  // hh:mm:ss
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [h, m, s2] = trimmed.split(":").map(Number);
    return h * 3600 + m * 60 + s2;
  }
  // 5.30 (minutos decimales)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    // Si es muy grande, son segundos directos
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

/** Genera un perfil sintético triangular (subida hasta mitad, bajada después). */
function generateSyntheticProfile(distanceKm: number, elevationGainM: number): AltimetryPoint[] {
  const points: AltimetryPoint[] = [];
  const kmCount = Math.max(2, Math.ceil(distanceKm));
  // El pico está en el medio, con un poco de asimetría
  const peakKm = kmCount / 2;
  // Distribución: 40% en primera mitad (subida), 60% en segunda (más bajada que subida)
  for (let i = 0; i <= kmCount; i++) {
    const km = i;
    let altitude: number;
    if (km <= peakKm) {
      // Subida: de 0 al pico
      const t = km / peakKm;
      altitude = elevationGainM * t;
    } else {
      // Bajada: del pico a 0
      const t = (km - peakKm) / (kmCount - peakKm);
      altitude = elevationGainM * (1 - t);
    }
    points.push({ km, altitudeM: Math.round(altitude) });
  }
  return points;
}

/** Calcula el ritmo ajustado por pendiente. */
function adjustPaceBySlope(
  basePace: number,
  slopePct: number,
): number {
  // Pendiente en % (positivo = subida, negativo = bajada)
  if (slopePct > 0) {
    // Subida: 4% más lento por 1% de pendiente
    return basePace * (1 + 0.04 * slopePct);
  } else {
    // Bajada: 2.5% más rápido por 1% de pendiente (cuesta abajo se gana menos de lo que se pierde cuesta arriba)
    return basePace * (1 - 0.025 * Math.abs(slopePct));
  }
}

export function PaceCalculator({
  distanceKm,
  elevationGainM,
  altimetryData,
}: {
  distanceKm: number;
  elevationGainM?: number;
  altimetryData?: AltimetryPoint[];
}) {
  // Si no hay altimetryData, generamos uno sintético
  const profile = useMemo<AltimetryPoint[]>(() => {
    if (altimetryData && altimetryData.length > 1) {
      return altimetryData;
    }
    if (elevationGainM && elevationGainM > 0) {
      return generateSyntheticProfile(distanceKm, elevationGainM);
    }
    // Plano: todos los kms a 0m
    const points: AltimetryPoint[] = [];
    for (let i = 0; i <= Math.ceil(distanceKm); i++) {
      points.push({ km: i, altitudeM: 0 });
    }
    return points;
  }, [altimetryData, elevationGainM, distanceKm]);

  // Estado: ritmo por km (en segundos)
  const [paces, setPaces] = useState<number[]>([]);
  const [basePaceStr, setBasePaceStr] = useState(paceToString(DEFAULT_BASE_PACE));
  const [autoAdjust, setAutoAdjust] = useState(true);
  const [useProfile, setUseProfile] = useState(!!(altimetryData && altimetryData.length > 1));

  const kmCount = profile.length - 1; // # de segmentos de 1km

  // Cuando cambia la distancia o el profile, regenerar paces
  useEffect(() => {
    const newPaces = computePaces(DEFAULT_BASE_PACE, profile, autoAdjust, useProfile, paces);
    setPaces(newPaces);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmCount, autoAdjust, useProfile]);

  // Calcular datos del gráfico
  const chartData = useMemo<PacePoint[]>(() => {
    if (paces.length === 0) return [];
    return profile.slice(1).map((p, i) => {
      // Segmento del km i al km i+1
      const prevAlt = i === 0 ? profile[0].altitudeM : profile[i].altitudeM;
      const altitude = (prevAlt + p.altitudeM) / 2;
      const pace = paces[i] ?? DEFAULT_BASE_PACE;
      return {
        km: i + 1,
        altitudeM: Math.round(altitude),
        paceSeconds: Math.round(pace),
        splitSeconds: Math.round(pace), // para un km
      };
    });
  }, [profile, paces]);

  // Tiempo total y ritmo medio
  const totalSeconds = useMemo(
    () => paces.reduce((sum, p) => sum + p, 0),
    [paces],
  );
  const avgPace = paces.length > 0 ? totalSeconds / paces.length : 0;

  // Handlers
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
    const sec = parsePaceInput(basePaceStr) ?? DEFAULT_BASE_PACE;
    if (newAuto) {
      // Al activar auto-adjust, recalcular todos
      const newPaces = computePaces(sec, profile, true, useProfile, []);
      setPaces(newPaces);
    }
  };

  const toggleProfile = () => {
    const newUse = !useProfile;
    setUseProfile(newUse);
    const sec = parsePaceInput(basePaceStr) ?? DEFAULT_BASE_PACE;
    if (newUse && altimetryData && altimetryData.length > 1) {
      // Al activar profile, recalcular
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

  // Detectar si hay altimetría real
  const hasRealAltimetry = !!(altimetryData && altimetryData.length > 1);
  const minAlt = Math.min(...chartData.map((d) => d.altitudeM));
  const maxAlt = Math.max(...chartData.map((d) => d.altitudeM));
  const yAxisDomain: [number, number] = [Math.min(0, minAlt - 10), maxAlt + 10];

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-runner-primary" />
          Calculadora de ritmos
        </h2>
        <div className="flex items-center gap-2 text-sm">
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
        </div>
      </div>

      <div className="card space-y-5">
        {/* ============ CONTROLES PRINCIPALES ============ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>

        {/* ============ GRÁFICO ALTIMETRÍA + RITMO ============ */}
        <div className="bg-gray-50 rounded-md p-3">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-gradient-to-t from-green-200 to-green-500 rounded-sm" />
              Altimetría (m)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-runner-primary" />
              Ritmo por km (s)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                domain={["auto", "auto"]}
                tick={{ fontSize: 10 }}
                width={45}
                tickFormatter={(v) => paceToString(v)}
                label={{ value: "s/km", angle: 90, position: "insideRight", fontSize: 10 }}
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
                dot={{ r: 3, fill: "#dc2626" }}
                activeDot={{ r: 5 }}
                name="Ritmo"
              />
              {chartData.length > 0 && (
                <ReferenceLine
                  yAxisId="right"
                  y={avgPace}
                  stroke="#6b7280"
                  strokeDasharray="4 4"
                  label={{ value: "Media", fontSize: 9, position: "insideTopRight" }}
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
                  <th className="text-right py-1.5 pl-2">Split parcial</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chartData.map((d, i) => {
                  // Calcular pendiente del segmento
                  const prevAlt = i === 0 ? profile[0].altitudeM : profile[i].altitudeM;
                  const slopePct = d.altitudeM - prevAlt;
                  return (
                    <tr key={d.km} className="hover:bg-gray-50">
                      <td className="py-1.5 pr-2 font-mono font-bold">{d.km}</td>
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
                            if (sec) updatePace(i, sec);
                          }}
                          className="w-20 text-right font-mono text-sm border border-gray-300 rounded px-1.5 py-0.5 focus:border-runner-primary focus:outline-none"
                        />
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
                  <td className="py-2 pl-2 text-right font-mono text-runner-primary text-base">
                    {formatTime(totalSeconds)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ============ NOTAS ============ */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
          <strong>Cómo funciona:</strong> El ritmo se ajusta automáticamente por la pendiente
          del km (≈ 4% más lento en subida por cada 1% de desnivel, ≈ 2.5% más rápido en bajada).
          Puedes sobrescribir el ritmo de cualquier km. Si solo hay ganancia total, se genera un
          perfil sintético triangular.
        </div>
      </div>
    </section>
  );
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
    const slopePct = gain; // metros por km = % de pendiente
    if (autoAdjust && useProfile) {
      result.push(Math.round(adjustPaceBySlope(basePace, slopePct)));
    } else {
      // Mantener el valor actual si existe, si no usar base
      if (currentPaces[i] && !autoAdjust) {
        result.push(currentPaces[i]);
      } else {
        result.push(Math.round(basePace));
      }
    }
  }
  return result;
}
