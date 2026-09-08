# Script PowerShell que ejecuta `npx convex run` preservando el JSON
# correctamente. Usa here-string @"..."@ para evitar que PowerShell
# interprete las comillas del JSON como fin de string.

$ErrorActionPreference = "Stop"

$FunctionName = "detectIntervalsBackfill:runBackfill"
$ArgsJson = @'
{ "userId": "jn753w354w4f4dqxsdkhz1a68d8drt79", "force": false }
'@

Set-Location "C:\desarrollo\mi-dorsal"

Write-Host "[run-backfill] Invoking: npx convex run --prod $FunctionName $ArgsJson"
Write-Host ""

# Llamada directa: pasamos cada parte como argumento separado, sin
# pasar por string interpolation.
& npx.cmd convex run --prod $FunctionName $ArgsJson

Write-Host ""
Write-Host "[run-backfill] Done. Exit code: $LASTEXITCODE"
