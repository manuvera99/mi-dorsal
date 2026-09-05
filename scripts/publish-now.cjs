// Ejecuta Convex CLI pasando args como array (sin shell)
const { spawnSync } = require("child_process");
const path = require("path");
const id = "kn74tmsrvx4dzyck1xa8d7ek258dvv0q";

const convexBin = path.join(
  __dirname,
  "..",
  "node_modules",
  "convex",
  "bin",
  "main.js",
);
const nodeExe = process.execPath;

// El JSON DEBE ir como un argumento único, no concatenado
const jsonArg = '{"id":"' + id + '"}';

console.log("Args:", ["run", jsonArg, "--prod"]);

const result = spawnSync(nodeExe, [convexBin, "run", jsonArg, "--prod"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

process.exit(result.status ?? 0);
