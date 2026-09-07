// =============================================================================
// scripts/list-top-candidates.ts
// =============================================================================
// Lista las 30 mejores carreras para enriquecimiento manual (featured primero,
// luego por fecha, publicadas y futuras).
//
// Uso: npx tsx --env-file=.env.local scripts/list-top-candidates.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const all = await c.query(api.races.systemListAll, { onlyWithOfficialUrl: true });
  const today = new Date().toISOString().slice(0, 10);
  // Una carrera está "publicada" si isPublished !== false (null/undefined/true son OK)
  const candidates = all.filter((r: any) => r.isPublished !== false && (!r.startDate || r.startDate >= today));
  candidates.sort((a: any, b: any) => {
    const fa = a.isFeatured ? 0 : 1;
    const fb = b.isFeatured ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999");
  });
  const top = candidates.slice(0, 30);
  console.log(`Top ${top.length} carreras (publicadas + futuras + con officialUrl):\n`);
  top.forEach((r: any, i: number) => {
    const fields = [
      r.organizer,
      r.organizerUrl,
      r.address,
      r.startTime,
      r.longDescription ? "longDesc" : null,
      r.raceFormats?.length ? `formats:${r.raceFormats.length}` : null,
      r.aidStations?.length ? `aid:${r.aidStations.length}` : null,
      r.latitude ? "geo" : null,
      r.imageUrl ? "img" : null,
      r.socialInstagram ? "IG" : null,
    ]
      .filter(Boolean)
      .join(", ");
    const star = r.isFeatured ? "*" : " ";
    console.log(`${star} ${(i + 1).toString().padStart(2)}. ${r.startDate} ${r.name}`);
    console.log(`     url:    ${r.officialUrl}`);
    console.log(`     tiene:  ${fields || "(vacío)"}`);
    console.log("");
  });
  console.log("Leyenda: * = featured (sale en home)");
  console.log("Enriquece via /admin/races/[id] (botón 'Extraer y aplicar' o edición manual)");
}

main().catch((e) => { console.error(e); process.exit(1); });
