// =============================================================================
// mi-dorsal — lib utils
// =============================================================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatProvince(province: string): string {
  const map: Record<string, string> = {
    alicante: "Alicante",
    valencia: "Valencia",
    castellon: "Castellón",
    murcia: "Murcia",
    albacete: "Albacete",
    almeria: "Almería",
  };
  return map[province] ?? province;
}

export function formatRaceType(type: string): string {
  const map: Record<string, string> = {
    road: "Asfalto",
    trail: "Trail",
    mixed: "Mixta",
    obstacle: "Obstáculos",
  };
  return map[type] ?? type;
}

export const PROVINCE_LIST = [
  { value: "alicante", label: "Alicante" },
  { value: "valencia", label: "Valencia" },
  { value: "castellon", label: "Castellón" },
  { value: "murcia", label: "Murcia" },
  { value: "albacete", label: "Albacete" },
  { value: "almeria", label: "Almería" },
] as const;

export const MONTH_LIST = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const RACE_TYPE_LIST = [
  { value: "road", label: "Asfalto" },
  { value: "trail", label: "Trail" },
  { value: "mixed", label: "Mixta" },
  { value: "obstacle", label: "Obstáculos" },
] as const;
