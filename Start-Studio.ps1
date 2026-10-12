param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$studioWorkspace = Split-Path (Split-Path $studioRoot -Parent) -Parent
$studioPython = Join-Path $studioWorkspace 'work\jewelryai-venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $studioPython)) {
    $studioPython = Join-Path $studioRoot '.venv\Scripts\python.exe'
}
if (-not (Test-Path -LiteralPath $studioPython)) {
    throw 'Python environment missing. Run Setup-Studio.ps1 first.'
}
$studioExistingData = Join-Path $studioWorkspace 'work\jewelryai-runtime'
if (-not $env:JEWELRYAI_DATA_DIR -and (Test-Path -LiteralPath $studioExistingData)) {
    $env:JEWELRYAI_DATA_DIR = $studioExistingData
}
Push-Location $studioRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'out\index.html'))) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    }
    Write-Host "JewelryAI Studio: http://127.0.0.1:$Port"
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop the local service.'
    & $studioPython -m uvicorn backend.main:app --host 127.0.0.1 --port $Port
} finally { Pop-Location }

