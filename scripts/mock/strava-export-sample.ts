// =============================================================================
// mi-dorsal — Genera un ZIP de ejemplo del export de Strava
// =============================================================================
// Crea un ZIP anonimizado con activities.csv y profile.csv para usar en dev
// y tests. NO contiene datos personales reales.
//
// Uso: npx tsx scripts/mock/strava-export-sample.ts
// Output: public/mock/strava-export-sample.zip
// =============================================================================

import JSZip from "jszip";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";

const OUTPUT_PATH = join(process.cwd(), "public", "mock", "strava-export-sample.zip");

// ---------------------------------------------------------------------------
// activities.csv
// ---------------------------------------------------------------------------

// 12 actividades sintéticas: 1 ultramarathon + 2 maratones + 2 medias + 3 10K
// + 2 tiradas largas + 1 series + 1 easy
// Nombres realistas (algunos matcheables con carreras reales de nuestro
// catálogo) y otros no (para probar el race_candidate).
const activities = [
  {
    "Activity ID": "1000001",
    "Activity Date": "2024-03-15 09:32:41",
    "Activity Name": "Maratón Valencia Trinidad Alfonso",
    "Activity Type": "Run",
    "Activity Description": "Dorsal 1287",
    "Elapsed Time": "12673",
    "Distance": "42195",
    "Max Heart Rate": "178",
    "Average Heart Rate": "162",
    "Average Speed": "3.33",
    "Average Cadence": "180",
    "Total Elevation Gain": "127",
    "Total Elevation Loss": "124",
    "Average Positive Grade": "0.3",
    "Average Negative Grade": "-0.3",
    "Calories": "2950",
    "Relative Effort": "245",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000002",
    "Activity Date": "2024-02-11 09:30:00",
    "Activity Name": "Media Maratón Valencia",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "5523",
    "Distance": "21097",
    "Max Heart Rate": "175",
    "Average Heart Rate": "158",
    "Average Speed": "3.82",
    "Average Cadence": "182",
    "Total Elevation Gain": "42",
    "Total Elevation Loss": "42",
    "Calories": "1620",
    "Relative Effort": "165",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000003",
    "Activity Date": "2024-01-21 10:15:00",
    "Activity Name": "10K Nocturna Valencia",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "2752",
    "Distance": "10000",
    "Max Heart Rate": "182",
    "Average Heart Rate": "172",
    "Average Speed": "3.63",
    "Average Cadence": "186",
    "Calories": "780",
    "Relative Effort": "132",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000004",
    "Activity Date": "2023-12-03 09:00:00",
    "Activity Name": "Tirada larga",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "7500",
    "Distance": "28000",
    "Average Heart Rate": "145",
    "Average Speed": "3.73",
    "Average Cadence": "176",
    "Total Elevation Gain": "180",
    "Calories": "2100",
    "Relative Effort": "210",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000005",
    "Activity Date": "2023-11-12 18:30:00",
    "Activity Name": "Series 6x1000",
    "Activity Type": "Run",
    "Activity Description": "Series en pista",
    "Elapsed Time": "3600",
    "Distance": "11000",
    "Average Heart Rate": "165",
    "Average Speed": "3.50",
    "Average Cadence": "184",
    "Calories": "850",
    "Relative Effort": "145",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000006",
    "Activity Date": "2023-10-22 08:00:00",
    "Activity Name": "Trail de la Calderona 25K",
    "Activity Type": "TrailRun",
    "Activity Description": "Trailaaaaa",
    "Elapsed Time": "9300",
    "Distance": "25000",
    "Average Heart Rate": "152",
    "Average Speed": "2.69",
    "Average Cadence": "168",
    "Total Elevation Gain": "1280",
    "Total Elevation Loss": "1280",
    "Calories": "2300",
    "Relative Effort": "278",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000007",
    "Activity Date": "2023-09-17 09:30:00",
    "Activity Name": "Carrera de la Mujer Valencia 5K",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "1493",
    "Distance": "5000",
    "Max Heart Rate": "184",
    "Average Heart Rate": "176",
    "Average Speed": "3.35",
    "Average Cadence": "188",
    "Calories": "385",
    "Relative Effort": "98",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000008",
    "Activity Date": "2023-08-05 07:30:00",
    "Activity Name": "Tirada larga calor agosto",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "8400",
    "Distance": "30000",
    "Average Heart Rate": "148",
    "Average Speed": "3.57",
    "Average Cadence": "175",
    "Total Elevation Gain": "120",
    "Calories": "2400",
    "Relative Effort": "232",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000009",
    "Activity Date": "2023-06-11 19:00:00",
    "Activity Name": "Recuperación",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "1800",
    "Distance": "6000",
    "Average Heart Rate": "128",
    "Average Speed": "3.33",
    "Average Cadence": "172",
    "Calories": "380",
    "Relative Effort": "42",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000010",
    "Activity Date": "2023-04-23 09:00:00",
    "Activity Name": "Maratón Madrid",
    "Activity Type": "Run",
    "Activity Description": "Dorsal 4567",
    "Elapsed Time": "13120",
    "Distance": "42195",
    "Max Heart Rate": "180",
    "Average Heart Rate": "164",
    "Average Speed": "3.22",
    "Average Cadence": "178",
    "Total Elevation Gain": "210",
    "Calories": "3050",
    "Relative Effort": "289",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000011",
    "Activity Date": "2023-03-12 09:00:00",
    "Activity Name": "10K Castelló",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "2812",
    "Distance": "10000",
    "Average Heart Rate": "168",
    "Average Speed": "3.56",
    "Average Cadence": "184",
    "Calories": "810",
    "Relative Effort": "138",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
  {
    "Activity ID": "1000012",
    "Activity Date": "2023-02-19 10:00:00",
    "Activity Name": "Maratón de Sevilla (carrera huérfana)",
    "Activity Type": "Run",
    "Activity Description": "",
    "Elapsed Time": "12890",
    "Distance": "42195",
    "Average Heart Rate": "161",
    "Average Speed": "3.27",
    "Average Cadence": "179",
    "Total Elevation Gain": "85",
    "Calories": "2980",
    "Relative Effort": "260",
    "Filename": "",
    "Athlete Weight": "68.5",
  },
];

// ---------------------------------------------------------------------------
// profile.csv
// ---------------------------------------------------------------------------

const profile = {
  "Athlete ID": "999999",
  "Username": "runner_demo",
  "Name": "Demo Runner",
  "First Name": "Demo",
  "Last Name": "Runner",
  "City": "Valencia",
  "State": "",
  "Country": "Spain",
  "Sex": "M",
  "Bio": "Demo account for mi-dorsal development",
  "Weight": "68.5",
  "Height": "174",
  "Max Heart Rate": "184",
  "Resting Heart Rate": "48",
  "Profile Photo": "",
  "Created At": "2018-01-15",
  "Updated At": "2024-03-20",
  "Timezone": "(GMT+01:00) Madrid",
};

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function toCsv<T extends Record<string, string | number | undefined>>(
  rows: T[],
): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const cells = headers.map((h) => {
      const v = row[h];
      if (v === undefined || v === null || v === "") return "";
      const s = String(v);
      // Escapar comas y comillas
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const zip = new JSZip();

  zip.file("activities.csv", toCsv(activities));
  zip.file("profile.csv", toCsv([profile]));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, buffer);

  console.log(`✅ ZIP de ejemplo generado en ${OUTPUT_PATH}`);
  console.log(`   ${activities.length} actividades, ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log("\nPara usarlo en dev:");
  console.log("  1. Activa NEXT_PUBLIC_USE_MOCK=false (modo real)");
  console.log("  2. Ve a /perfil");
  console.log("  3. Click 'Subir export' → arrastra el ZIP");
  console.log("\nPara regenerarlo:");
  console.log("  npx tsx scripts/mock/strava-export-sample.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
