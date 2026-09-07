<#
.SYNOPSIS
  Monitor SEO de mi-dorsal.com: health, sitemap, indexación, encoding.
.DESCRIPTION
  Ejecuta una batería de checks y devuelve un report en color.

  Checks:
    1. Health check: home, /carreras, /blog, sitemap, robots → 200 y tiempo
    2. Sitemap: cuenta URLs y verifica que sea XML válido
    3. Encoding en HTML servido: busca secuencias de mojibake (EspaÃ±a, Â·, etc.)
    4. Mojibake en código fuente (.ts/.tsx) — para pillar bugs antes de que
       Google los indexe
    5. Indexación: usa Bing como proxy para ver cuántas URLs tiene el buscador
       en su índice. Para el conteo de Google real, abrir GSC.

.PARAMETER Domain
  Dominio a monitorizar. Por defecto https://www.mi-dorsal.com.

.PARAMETER Repo
  Ruta al repo. Por defecto se autodetecta desde la ubicación del script.

.EXAMPLE
  .\scripts\seo-monitor.ps1
  .\scripts\seo-monitor.ps1 -Domain "https://www.mi-dorsal.es"

.NOTES
  Autor: Manu Vera + Mavis · 7 sept 2026
  Pensado para PowerShell 5.1+ en Windows.
#>

[CmdletBinding()]
param(
    [string]$Domain = "https://www.mi-dorsal.com",
    [string]$Repo = (Split-Path -Parent (Split-Path -Parent $PSCommandPath))
)

$ErrorActionPreference = 'Continue'
$mojibakePattern = 'Ã[¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿]|Â·|â€[œ¦]'

# ============== Funciones de output ==============

function Write-Banner {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host " SEO Monitor — $Domain" -ForegroundColor Cyan
    Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Gray
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section($name) {
    Write-Host ""
    Write-Host "▶ $name" -ForegroundColor Cyan
    Write-Host ("-" * 70) -ForegroundColor DarkGray
}

function Write-OK($msg)     { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn($msg)   { Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Fail($msg)   { Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Info($msg)   { Write-Host "  ·  $msg" -ForegroundColor Gray }

# ============== Check 1: Health ==============

function Test-Health {
    $paths = @("/", "/carreras", "/blog", "/ranking", "/sitemap.xml", "/robots.txt")
    $results = @()
    foreach ($p in $paths) {
        $url = "$Domain$p"
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
            $sw.Stop()
            $ms = [int]$sw.ElapsedMilliseconds
            $code = [int]$r.StatusCode
            if ($code -eq 200) {
                if ($ms -lt 2000) { Write-OK "$url  →  $code  (${ms}ms)" }
                else { Write-Warn "$url  →  $code  (${ms}ms, lento)" }
                $results += [PSCustomObject]@{ URL = $url; Code = $code; Ms = $ms }
            } else {
                Write-Fail "$url  →  $code"
                $results += [PSCustomObject]@{ URL = $url; Code = $code; Ms = $ms }
            }
        } catch {
            $code = $null
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
            Write-Fail "$url  →  $($_.Exception.Message)"
            $results += [PSCustomObject]@{ URL = $url; Code = $code; Ms = -1 }
        }
    }
    return $results
}

# ============== Check 2: Sitemap ==============

function Test-Sitemap {
    $url = "$Domain/sitemap.xml"
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -ne 200) { Write-Fail "Sitemap no accesible: $url → $($r.StatusCode)"; return $null }
        try {
            $xml = [xml]$r.Content
            $count = $xml.urlset.url.Count
            $ns = $xml.urlset.NamespaceURI
            if ($ns -match "sitemaps.org") {
                Write-OK "Sitemap válido: $count URLs, namespace correcto"
            } else {
                Write-Warn "Sitemap accesible pero namespace inesperado: $ns"
            }
            return $count
        } catch {
            Write-Fail "Sitemap accesible pero XML inválido: $($_.Exception.Message)"
            return $null
        }
    } catch {
        Write-Fail "Sitemap no accesible: $url → $($_.Exception.Message)"
        return $null
    }
}

# ============== Check 3: Encoding en HTML servido ==============

function Test-ServedEncoding {
    $pages = @("", "/carreras", "/blog", "/ranking")
    $issues = 0
    foreach ($p in $pages) {
        $url = "$Domain$p"
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
            $matches = [regex]::Matches($r.Content, $mojibakePattern)
            if ($matches.Count -eq 0) {
                Write-OK "$url  →  sin mojibake"
            } else {
                $sample = ($matches | Select-Object -First 3 | ForEach-Object { $_.Value }) -join " "
                Write-Fail "$url  →  $($matches.Count) secuencias de mojibake (muestra: $sample)"
                $issues += $matches.Count
            }
        } catch {
            Write-Warn "$url  →  no se pudo verificar ($($_.Exception.Message))"
        }
    }
    return $issues
}

# ============== Check 4: Mojibake en código fuente ==============

function Test-SourceMojibake {
    if (-not (Test-Path $Repo)) {
        Write-Warn "Repo no encontrado: $Repo"
        return 0
    }
    $tsFiles = Get-ChildItem -Path $Repo -Recurse -Include "*.ts", "*.tsx" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "node_modules|\.next|dist|build" }
    $bad = @()
    foreach ($f in $tsFiles) {
        try {
            $content = Get-Content $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($content -match $mojibakePattern) {
                $bad += $f.FullName.Replace($Repo + [IO.Path]::DirectorySeparatorChar, "")
            }
        } catch { }
    }
    if ($bad.Count -eq 0) {
        Write-OK "Sin mojibake en código fuente ($($tsFiles.Count) archivos escaneados)"
    } else {
        Write-Fail "$($bad.Count) archivos con mojibake:"
        $bad | ForEach-Object { Write-Host "      $_" -ForegroundColor Yellow }
    }
    return $bad.Count
}

# ============== Check 5: Indexación (Bing como proxy) ==============

function Test-Indexing {
    $url = "https://www.bing.com/search?q=site%3A$($Domain.Replace('https://','').Replace('http://',''))"
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        $countMatch = [regex]::Match($r.Content, '([0-9.,]+)\s+resultados')
        if ($countMatch.Success) {
            $count = $countMatch.Groups[1].Value
            Write-Info "Bing tiene ~$count resultados para site:$Domain"
        } else {
            $countMatch2 = [regex]::Match($r.Content, 'class="sb_count"[^>]*>([^<]+)<')
            if ($countMatch2.Success) {
                Write-Info "Bing: $($countMatch2.Groups[1].Value)"
            } else {
                Write-Info "Bing: no se pudo extraer el conteo (puede ser un captcha)"
            }
        }
    } catch {
        Write-Warn "No se pudo consultar Bing: $($_.Exception.Message)"
    }
    Write-Info "Para el conteo real de Google, abre GSC → Cobertura (es la verdad oficial)"
}

# ============== Resumen final ==============

function Write-Summary($healthResults, $sitemapCount, $encodingIssues, $sourceIssues) {
    $errors = 0
    $warns = 0
    foreach ($r in $healthResults) { if ($r.Code -ne 200) { $errors++ } }
    if ($sitemapCount -eq $null) { $errors++ }
    if ($encodingIssues -gt 0) { $errors++ }
    if ($sourceIssues -gt 0) { $errors++ }

    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    if ($errors -eq 0) {
        Write-Host " ✅ TODO OK" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  $errors problema(s) encontrado(s)" -ForegroundColor Yellow
    }
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host ""

    if ($errors -gt 0) { exit 1 }
}

# ============== Main ==============

Write-Banner
Write-Section "1. Health check"
$health = Test-Health

Write-Section "2. Sitemap"
$sitemapCount = Test-Sitemap

Write-Section "3. Encoding en HTML servido"
$encIssues = Test-ServedEncoding

Write-Section "4. Mojibake en código fuente"
$srcIssues = Test-SourceMojibake

Write-Section "5. Indexación en buscadores"
Test-Indexing

Write-Summary $health $sitemapCount $encIssues $srcIssues
