// Componente compartido de KPI para paneles de admin. Antes había 3 copias
// casi idénticas (app/admin/page.tsx, app/admin/race-suggestions/page.tsx,
// y ninguna en app/admin/races/page.tsx que aun no tenía KPIs) — auditoría
// 2026-09-11. Soporta las dos variantes visuales que ya existían: "md"
// (icono arriba, valor grande, label debajo, sub opcional) y "sm" (label +
// icono en la misma fila, valor debajo, sin sub).

import type { LucideIcon } from "lucide-react";

const COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
};

export type StatCardColor = keyof typeof COLORS;

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  size = "md",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color: StatCardColor;
  size?: "sm" | "md";
}) {
  const colorClass = COLORS[color] ?? COLORS.gray;

  if (size === "sm") {
    return (
      <div className="bg-white rounded-lg border p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{label}</span>
          <div className={`p-1 rounded ${colorClass}`}>
            <Icon className="h-3 w-3" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-md ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
