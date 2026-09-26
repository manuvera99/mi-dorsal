// Auditoría operativa: agrupa notificationLog por día + tipo y muestra
// una tabla legible. Útil para "¿los crons están ejecutándose?".
//
// Uso:
//   npx convex data --prod notificationLog --format json --limit 5000 \
//     | node scripts/audit-notif-by-day.mjs

let input = "";
for await (const chunk of process.stdin) input += chunk;

// Limpiar líneas de log de Convex (no son JSON)
const startIdx = input.indexOf("[");
if (startIdx > 0) input = input.slice(startIdx);
const endIdx = input.lastIndexOf("]");
if (endIdx > 0 && endIdx < input.length - 1) input = input.slice(0, endIdx + 1);

let data;
try {
  data = JSON.parse(input);
} catch (e) {
  console.error("JSON inválido. Primeras 200 chars:", input.slice(0, 200));
  process.exit(1);
}

console.log(`Total filas: ${data.length}\n`);

const byDayType = {};
for (const row of data) {
  const d = new Date(row._creationTime);
  const day = d.toISOString().slice(0, 10);
  const type = row.type;
  byDayType[day] = byDayType[day] || {};
  byDayType[day][type] = (byDayType[day][type] || 0) + 1;
}

const days = Object.keys(byDayType).sort().reverse();
console.log("Día".padEnd(12), "result  result_not  reminder_7d  reminder_1d  photos  result_found  other");
for (const day of days) {
  const t = byDayType[day];
  const fmt = (k) => String(t[k] || 0).padStart(3);
  console.log(
    day,
    fmt("result_found"),
    String(t["result_not_found"] || 0).padStart(3),
    String(t["reminder_7d"] || 0).padStart(3),
    String(t["reminder_1d"] || 0).padStart(3),
    String(t["photos_found"] || 0).padStart(3),
    String(t["result_found"] || 0).padStart(3),
    Object.entries(t)
      .filter(([k]) => !["result_found", "result_not_found", "reminder_7d", "reminder_1d", "photos_found"].includes(k))
      .map(([k, v]) => `${k}=${v}`)
      .join(" "),
  );
}
