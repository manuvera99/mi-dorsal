# PowerShell wrapper para escapar correctamente el JSON
$id = "kn74tmsrvx4dzyck1xa8d7ek258dvv0q"
$json = '{"id":"' + $id + '"}'
Write-Host "JSON: $json"
& npx convex run blog:publish $json --prod 2>&1 | Select-Object -First 10
