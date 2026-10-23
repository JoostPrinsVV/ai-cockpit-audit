# ============================================================================
# Nieuwe versie van de site: zet ?v=<datum en tijd> achter alle eigen bestanden
# in index.html. Daardoor haalt iedere browser na een nieuwe versie alles opnieuw
# op (GitHub Pages laat browsers bestanden 10 minuten bewaren; zonder dit kan een
# oud bestand naast een nieuw belanden). Bestanden die later worden geladen
# (beheer, data/) krijgen automatisch dezelfde versie (zie js/ui.js).
#
# Gebruik (PowerShell, in de map van de repository):
#   powershell -ExecutionPolicy Bypass -File tools/versie.ps1
# Daarna index.html meecommitten.
# ============================================================================
$ErrorActionPreference = 'Stop'
$index = Join-Path $PSScriptRoot '..\index.html'
$version = Get-Date -Format 'yyyyMMddHHmm'
$text = [IO.File]::ReadAllText($index)
$count = ([regex]::Matches($text, '\?v=[0-9]+')).Count
if (-not $count) { throw 'Geen ?v= gevonden in index.html' }
$text = [regex]::Replace($text, '\?v=[0-9]+', '?v=' + $version)
[IO.File]::WriteAllText($index, $text, (New-Object Text.UTF8Encoding $false))
Write-Output "Versie $version gezet ($count bestanden in index.html)."
