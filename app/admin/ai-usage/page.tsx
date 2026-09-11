"use client";

// Páginas admin: no se prerenderizan porque usan Clerk+Convex en cliente.
export const dynamic = "force-dynamic";

// =============================================================================
// mi-dorsal — /admin/ai-usage
// =============================================================================
// Panel de uso de IA. Muestra, en una ventana configurable (default 30 días):
//   - KPIs globales: total llamadas, tokens, coste, último uso, errores.
//   - Gráfica de barras de tokens por día (prompt + completion apilados).
//   - Gráfica de coste diario en €.
//   - Tabla "de dónde vienen": total por función de lib/ai/*, ordenado por
//     tokens totales descendente.
//   - Tabla "por modelo": total por modelo (gpt-4o-mini, MiniMax-M3, etc.),
//     ordenado por coste.
//   - Tabla "actividad reciente": las últimas N llamadas con sus tokens y
//     coste, para debug en vivo.
//
// Los datos se leen de la tabla aiUsageLog (Convex), instrumentada por
// lib/ai/log-usage.ts desde cada llamada a un LLM en lib/ai/*.
// =============================================================================

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMockMode } from "@/lib/mock/provider";
import {
  Sparkles,
  Coins,
  Activity,
  AlertTriangle,
  Clock,
  Loader2,
  BarChart3,
  Layers,
  Calendar,
  Cpu,
  TrendingUp,
} from "lucide-react";

// =============================================================================
// Tipos
// =============================================================================

type Summary = {
  windowDays: number;
  totalCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostEur: number;
  uniqueModels: number;
  uniqueFunctions: number;
  errors: number;
  lastCallAt: number | null;
};

type Daily = {
  dateUtc: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEur: number;
  errors: number;
};

type ByFunction = {
  functionLabel: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEur: number;
  errors: number;
};

type ByModel = {
  model: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEur: number;
};

type Recent = {
  _id: string;
  _creationTime: number;
  timestamp: number;
  functionLabel: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEur: number;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
  dateUtc: string;
};

// =============================================================================
// Constantes y helpers
// =============================================================================

const FUNCTION_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  extract_race: {
    label: "Extraer carrera",
    emoji: "🏁",
    color: "bg-blue-100 text-blue-700",
  },
  extract_race_deep: {
    label: "Extracción profunda",
    emoji: "🔍",
    color: "bg-indigo-100 text-indigo-700",
  },
  analyze_source: {
    label: "Analizar fuente",
    emoji: "🌐",
    color: "bg-amber-100 text-amber-700",
  },
  coach_analysis: {
    label: "Análisis entrenador",
    emoji: "🧠",
    color: "bg-purple-100 text-purple-700",
  },
  resolve_race_url: {
    label: "Resolver URL rota",
    emoji: "🔎",
    color: "bg-teal-100 text-teal-700",
  },
};

const WINDOW_OPTIONS = [7, 30, 90] as const;

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

function fmtEur(n: number): string {
  if (n < 0.01 && n > 0) return "<0,01 €";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function fmtDate(iso: string): string {
  // iso = "YYYY-MM-DD" en UTC. Lo mostramos en es-ES con mes corto.
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function functionInfo(label: string) {
  return (
    FUNCTION_LABEL[label] ?? {
      label,
      emoji: "🤖",
      color: "bg-gray-100 text-gray-700",
    }
  );
}

// =============================================================================
// Componentes reutilizables
// =============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: "purple" | "amber" | "blue" | "green" | "red" | "gray";
  sub?: string;
}) {
  const colors: Record<string, string> = {
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
          {label}
        </span>
        <div className={`p-1.5 rounded-md ${colors[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-runner-dark">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <h2 className="text-base font-semibold text-runner-dark mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-runner-primary" />
        {title}
      </h2>
      {empty ? (
        <p className="text-sm text-gray-400 py-4 text-center">Sin datos en este periodo.</p>
      ) : (
        children
      )}
    </div>
  );
}

// =============================================================================
// Gráfica de barras (HTML + Tailwind, sin librerías externas)
// =============================================================================
function BarChart({
  data,
  maxValue,
  formatValue,
  barColorClass = "bg-runner-primary",
  emptyColorClass = "bg-gray-100",
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  formatValue: (n: number) => string;
  barColorClass?: string;
  emptyColorClass?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">Sin datos.</p>
    );
  }
  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = maxValue > 0 ? Math.max(2, (d.value / maxValue) * 100) : 0;
        return (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-gray-500 font-mono">{d.label}</span>
            <div className={`flex-1 h-5 rounded ${emptyColorClass} overflow-hidden`}>
              <div
                className={`h-full ${barColorClass} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-gray-700">
              {formatValue(d.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Mock (sin Convex)
// =============================================================================

function MockAiUsage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Uso de IA</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Tokens gastados, de dónde vienen y coste estimado.
      </p>
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        Modo mock — la gestión de uso de IA no está disponible. Conecta con Convex.
      </div>
    </div>
  );
}

// =============================================================================
// Real
// =============================================================================

function RealAiUsage() {
  const [days, setDays] = useState<number>(30);
  const summary = useQuery(api.aiUsage.getSummary, { days });
  const daily = useQuery(api.aiUsage.getDaily, { days });
  const byFunction = useQuery(api.aiUsage.getByFunction, { days });
  const byModel = useQuery(api.aiUsage.getByModel, { days });
  const recent = useQuery(api.aiUsage.getRecent, { limit: 20 });

  const isLoading =
    summary === undefined ||
    daily === undefined ||
    byFunction === undefined ||
    byModel === undefined ||
    recent === undefined;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-3 text-sm">Cargando uso de IA…</p>
        </div>
      </div>
    );
  }

  const s = summary as Summary;
  const d = daily as Daily[];
  const f = byFunction as ByFunction[];
  const m = byModel as ByModel[];
  const r = recent as Recent[];

  // ===== Gráfica de tokens por día =====
  const tokensByDay = d.map((row) => ({
    label: fmtDate(row.dateUtc),
    value: row.totalTokens,
  }));
  const maxTokens = Math.max(1, ...tokensByDay.map((x) => x.value));

  // ===== Gráfica de coste por día =====
  const costByDay = d.map((row) => ({
    label: fmtDate(row.dateUtc),
    value: row.costEur,
  }));
  const maxCost = Math.max(0.01, ...costByDay.map((x) => x.value));

  // ===== Gráfica de errores por día =====
  const errorsByDay = d
    .filter((row) => row.errors > 0)
    .map((row) => ({
      label: fmtDate(row.dateUtc),
      value: row.errors,
    }));

  return (
    <div className="p-8 max-w-screen-2xl">
      {/* Cabecera + selector de ventana */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-runner-dark mb-1">
            Uso de IA
          </h1>
          <p className="text-gray-600 text-sm">
            Tokens gastados, de dónde vienen y coste estimado en €.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                days === w
                  ? "bg-runner-primary text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {w} días
            </button>
          ))}
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Llamadas"
          value={fmtNumber(s.totalCalls)}
          icon={Activity}
          color="blue"
          sub={`${s.uniqueFunctions} funciones · ${s.uniqueModels} modelos`}
        />
        <StatCard
          label="Tokens"
          value={fmtNumber(s.totalTokens)}
          icon={Layers}
          color="purple"
          sub={`${fmtNumber(s.totalPromptTokens)} input · ${fmtNumber(s.totalCompletionTokens)} output`}
        />
        <StatCard
          label="Coste estimado"
          value={fmtEur(s.totalCostEur)}
          icon={Coins}
          color="amber"
          sub="Calculado con lib/ai/pricing.ts"
        />
        <StatCard
          label="Errores"
          value={fmtNumber(s.errors)}
          icon={AlertTriangle}
          color={s.errors > 0 ? "red" : "green"}
          sub={s.errors > 0 ? "Llamadas fallidas" : "Todo OK"}
        />
        <StatCard
          label="Último uso"
          value={
            s.lastCallAt
              ? new Date(s.lastCallAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"
          }
          icon={Clock}
          color="gray"
          sub={
            s.lastCallAt
              ? new Date(s.lastCallAt).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Sin datos"
          }
        />
        <StatCard
          label="Media / día"
          value={s.totalCalls > 0 ? fmtNumber(Math.round(s.totalCalls / days)) : "0"}
          icon={TrendingUp}
          color="gray"
          sub="Llamadas en ventana"
        />
      </div>

      {/* ===== Gráficas diarias (tokens + coste) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionCard title="Tokens por día" icon={BarChart3} empty={d.length === 0}>
          <BarChart
            data={tokensByDay}
            maxValue={maxTokens}
            formatValue={(n) => fmtNumber(n) + " tok"}
          />
        </SectionCard>
        <SectionCard title="Coste por día (€)" icon={Coins} empty={d.length === 0}>
          <BarChart
            data={costByDay}
            maxValue={maxCost}
            formatValue={(n) => fmtEur(n)}
            barColorClass="bg-amber-500"
          />
        </SectionCard>
      </div>

      {/* ===== Desglose por función y por modelo ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionCard
          title="De dónde vienen (por función)"
          icon={Sparkles}
          empty={f.length === 0}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-2 font-medium">Función</th>
                  <th className="py-2 pr-2 font-medium text-right">Llamadas</th>
                  <th className="py-2 pr-2 font-medium text-right">Tokens</th>
                  <th className="py-2 pr-2 font-medium text-right">Coste</th>
                  <th className="py-2 font-medium text-right">Errores</th>
                </tr>
              </thead>
              <tbody>
                {f.map((row) => {
                  const info = functionInfo(row.functionLabel);
                  return (
                    <tr key={row.functionLabel} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${info.color}`}
                        >
                          {info.emoji} {info.label}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">
                        {fmtNumber(row.calls)}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">
                        {fmtNumber(row.totalTokens)}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">
                        {fmtEur(row.costEur)}
                      </td>
                      <td className="py-2 text-right">
                        {row.errors > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                            {row.errors}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Por modelo" icon={Cpu} empty={m.length === 0}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-2 font-medium">Modelo</th>
                  <th className="py-2 pr-2 font-medium text-right">Llamadas</th>
                  <th className="py-2 pr-2 font-medium text-right">Tokens</th>
                  <th className="py-2 font-medium text-right">Coste</th>
                </tr>
              </thead>
              <tbody>
                {m.map((row) => (
                  <tr key={row.model} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {row.model}
                      </code>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {fmtNumber(row.calls)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {fmtNumber(row.totalTokens)}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {fmtEur(row.costEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* ===== Errores por día (solo si hay) ===== */}
      {errorsByDay.length > 0 && (
        <div className="mb-6">
          <SectionCard title="Errores por día" icon={AlertTriangle}>
            <BarChart
              data={errorsByDay}
              maxValue={Math.max(...errorsByDay.map((x) => x.value))}
              formatValue={(n) => fmtNumber(n)}
              barColorClass="bg-red-500"
            />
          </SectionCard>
        </div>
      )}

      {/* ===== Actividad reciente ===== */}
      <SectionCard
        title="Últimas 20 llamadas"
        icon={Calendar}
        empty={r.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-2 font-medium">Cuándo</th>
                <th className="py-2 pr-2 font-medium">Función</th>
                <th className="py-2 pr-2 font-medium">Modelo</th>
                <th className="py-2 pr-2 font-medium text-right">Input</th>
                <th className="py-2 pr-2 font-medium text-right">Output</th>
                <th className="py-2 pr-2 font-medium text-right">Total</th>
                <th className="py-2 pr-2 font-medium text-right">Coste</th>
                <th className="py-2 pr-2 font-medium text-right">Duración</th>
                <th className="py-2 font-medium text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {r.map((row) => {
                const info = functionInfo(row.functionLabel);
                return (
                  <tr
                    key={row._id}
                    className="border-b last:border-0 hover:bg-gray-50"
                    title={row.errorMessage ?? undefined}
                  >
                    <td className="py-2 pr-2 font-mono text-gray-600 whitespace-nowrap">
                      {fmtDateTime(row.timestamp)}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${info.color}`}
                      >
                        {info.emoji} {info.label}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded">
                        {row.model}
                      </code>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {fmtNumber(row.promptTokens)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {fmtNumber(row.completionTokens)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono font-semibold">
                      {fmtNumber(row.totalTokens)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {fmtEur(row.costEur)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-gray-500">
                      {row.durationMs != null
                        ? `${(row.durationMs / 1000).toFixed(1)}s`
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {row.success ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                          OK
                        </span>
                      ) : (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700"
                          title={row.errorMessage ?? ""}
                        >
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Disclaimer honesto: coste es estimación */}
      <p className="text-xs text-gray-400 mt-6 text-center">
        Coste estimado con precios hardcoded en{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">lib/ai/pricing.ts</code>.
        Refleja el coste a precio del momento de cada llamada. Para "coste a
        precios de hoy" habría que recalcular con la tabla actualizada.
      </p>
    </div>
  );
}

export default function AdminAiUsagePage() {
  return isMockMode() ? <MockAiUsage /> : <RealAiUsage />;
}
