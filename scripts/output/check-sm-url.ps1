$urls = @(
  'https://sportmaniacs.com/es/race/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/races/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/evento/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/events/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/carrera/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/carreras/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/r/soy-leyenda-gravel-btt-2027',
  'https://sportmaniacs.com/es/6a61a8c4-a478-42db-aaa2-4d7bac1f1238'
)
$h = @{ 'User-Agent' = 'Mozilla/5.0' }
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri $u -Headers $h -Method Head -UseBasicParsing -MaximumRedirection 5
    "$u → $($r.StatusCode)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if (-not $code) { $code = 'N/A' }
    "$u → $code"
  }
}
