"use client";

// =============================================================================
// mi-dorsal — Selector de club de atletismo con opción "Otro"
// =============================================================================
// Lista de clubes federados en la RFEA, agrupados por CCAA. Incluye al final
// una opción "Otro (especificar)" para clubes populares no federados (p. ej.
// "Bull Runners") o para introducir manualmente un nombre que no esté.
//
// Datos: `lib/data/clubs.json` (cacheados en build, sin API en runtime).
// 3.812 clubes únicos de las 17 CCAA + Ceuta + Melilla a fecha de ingest.
//
// Patrón de valor guardado: el `value` externo es siempre el string del club
// (sea uno de la lista o uno escrito a mano). El componente sólo gestiona
// la presentación; el padre no se entera de si el usuario eligió de la
// lista o escribió "Otro".
// =============================================================================

import { useMemo, useState } from "react";
import clubsData from "@/lib/data/clubs.json";

// Forma del JSON (subset relevante).
type ClubEntry = { name: string; ccaa: string };
type ClubsPayload = {
  source: string;
  fetchedAt: string;
  total: number;
  clubs: ClubEntry[];
};

const data = clubsData as ClubsPayload;

// Constantes para identificar la opción "Otro" en el <select>.
// Usamos un value "mágico" que nunca puede coincidir con un nombre real.
const OTHER_VALUE = "__other__";

export interface ClubSelectProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Máximo de caracteres admitidos en el input de "Otro". Default 80. */
  maxLength?: number;
}

/**
 * Agrupa los clubes por CCAA, ordenando CCAA y nombre alfabéticamente.
 * Memoizado a nivel de módulo porque `data` es estática.
 */
const CLUBS_BY_CCAA: { ccaa: string; clubs: ClubEntry[] }[] = (() => {
  const groups = new Map<string, ClubEntry[]>();
  for (const c of data.clubs) {
    const list = groups.get(c.ccaa) ?? [];
    list.push(c);
    groups.set(c.ccaa, list);
  }
  return Array.from(groups.entries())
    .map(([ccaa, clubs]) => ({
      ccaa,
      // Orden por nombre usando collation española (á después de a, etc.).
      clubs: clubs.sort((a, b) => a.name.localeCompare(b.name, "es")),
    }))
    .sort((a, b) => a.ccaa.localeCompare(b.ccaa, "es"));
})();

export function ClubSelect({
  value,
  onChange,
  disabled,
  maxLength = 80,
}: ClubSelectProps) {
  // El valor externo puede ser:
  //   - "" → "Sin club"
  //   - uno de los clubes de la lista (CCAA + nombre) → "<option>" seleccionado
  //   - texto libre que NO está en la lista → "Otro (especificar)" + input
  // Para distinguirlos, vemos si `value` matchea exactamente algún club.
  const isExactMatch = useMemo(
    () => data.clubs.some((c) => c.name === value),
    [value],
  );

  // El <select> puede tener 3 valores:
  //   "" (sin club), el nombre del club, o OTHER_VALUE (es "Otro").
  const selectValue = isExactMatch || value === "" ? value : OTHER_VALUE;
  const isOther = selectValue === OTHER_VALUE;

  // Estado del input de "Otro". Mantenido aparte del `value` externo para
  // evitar re-renders raros mientras el usuario teclea: el padre solo recibe
  // el valor final cuando se confirma o cuando se cierra el modal.
  const [otherText, setOtherText] = useState<string>(
    isOther ? value : "",
  );

  const handleSelectChange = (next: string) => {
    if (next === OTHER_VALUE) {
      // Cambió a "Otro": mantenemos el texto previo si era uno libre, si no vacío.
      // Importante: usar el `value` externo (no `otherText` del state) porque
      // `otherText` aún tiene el valor anterior a esta interacción.
      const newOtherText = value && !isExactMatch ? value : "";
      setOtherText(newOtherText);
      onChange(newOtherText);
    } else {
      // Volvió a un club de la lista o a "Sin club".
      onChange(next);
    }
  };

  const handleOtherInputChange = (next: string) => {
    const trimmed = next.slice(0, maxLength);
    setOtherText(trimmed);
    // Propagamos al padre en tiempo real: si el usuario está tecleando,
    // queremos que vea el cambio en el preview del modal.
    onChange(trimmed);
  };

  return (
    <div>
      <select
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed bg-white"
        aria-label="Club de atletismo"
      >
        <option value="">— Sin club —</option>
        {CLUBS_BY_CCAA.map(({ ccaa, clubs }) => (
          <optgroup key={ccaa} label={ccaa}>
            {clubs.map((c) => (
              <option key={`${c.ccaa}|${c.name}`} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER_VALUE}>Otro (especificar)…</option>
      </select>

      {isOther && (
        <div className="mt-2">
          <input
            type="text"
            value={otherText}
            onChange={(e) => handleOtherInputChange(e.target.value)}
            maxLength={maxLength}
            placeholder="Nombre de tu club"
            disabled={disabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Tu club no está federado en la RFEA (o es un club popular como Bull Runners).
            Lo guardamos tal cual.
          </p>
        </div>
      )}
    </div>
  );
}
