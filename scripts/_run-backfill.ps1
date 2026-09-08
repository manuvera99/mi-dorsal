# Ejecuta npx convex run con args JSON desde PowerShell sin que se rompan
# las comillas. Construye el comando como array y usa Start-Process.
param(
    [Parameter(Mandatory)][string]$FunctionName,
    [string]$JsonArgs = '{}',
    [switch]$Prod
)

$cmdParts = @('convex', 'run', $FunctionName, $JsonArgs)
if ($Prod) { $cmdParts = @('convex', 'run', '--prod', $FunctionName, $JsonArgs) }

# Llamar npx con el array — esto preserva los args literalmente
& npx @cmdParts
