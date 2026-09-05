// =============================================================================
// scripts/delete-pre2026-chiplevante.ts
// =============================================================================
// Borra las carreras de chiplevante.com con startDate < 2026-01-01.
// Se ejecuta una vez para limpiar el histórico lejano que se subió por error
// en la primera pasada del script de ingest (no tenía filtro de año).
//
// Idempotente: si no hay nada que borrar, sale con 0.
// Uso:  npx tsx --env-file=.env.local scripts/delete-pre2026-chiplevante.ts
// =============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("NEXT_PUBLIC_CONVEX_URL no configurado");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);

  console.log("Buscando carreras de chiplevante.com con fecha < 2026-01-01...");
  const all: any[] = await client.query(api.races.systemListAllDetailed, {});
  const pre2026 = all.filter(
    (r) =>
      r.officialUrl?.includes("chiplevante.com") &&
      r.startDate &&
      r.startDate < "2026-01-01",
  );

  console.log(`Encontradas: ${pre2026.length} carreras a borrar`);

  if (pre2026.length === 0) {
    console.log("✅ Nada que borrar. Saliendo.");
    process.exit(0);
  }

  // Confirmar antes de borrar (seguridad: no hay undo)
  console.log(
    `\n⚠️  Vas a borrar ${pre2026.length} carreras de chiplevante.com con fecha anterior a 2026-01-01.`,
  );
  console.log("   Si hay myRaces apuntando a estas carreras, también se quedarán huérfanas.");
  console.log("   Procediendo en 2 segundos… (Ctrl-C para abortar)\n");
  await new Promise((r) => setTimeout(r, 2000));

  let deleted = 0;
  const errors: string[] = [];
  for (const race of pre2026) {
    try {
      await client.mutation(api.races.systemDelete, { id: race._id });
      deleted++;
      if (deleted % 50 === 0) process.stdout.write(`\n   ${deleted}…`);
      else process.stdout.write(".");
    } catch (err: any) {
      errors.push(`${race.name}: ${err?.message ?? err}`);
    }
  }

  console.log(`\n\n✅ Borradas: ${deleted}`);
  if (errors.length) console.log(`❌ Errores: ${errors.length}`, errors.slice(0, 5));
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
