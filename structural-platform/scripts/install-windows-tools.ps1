[CmdletBinding()]
param([switch]$SkipDocker, [switch]$SkipDatabaseBrowser)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Run this script on your Windows computer.' }
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'WinGet is missing. Install/update Microsoft App Installer from Microsoft Store, then run again.'
}
function Install-Tool([string]$PackageId) {
    winget list --id $PackageId --exact --accept-source-agreements | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "$PackageId is already installed."; return }
    winget install --id $PackageId --exact --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -notin @(0, 3010, 1641)) { throw "Installation failed for $PackageId. WinGet exit code: $LASTEXITCODE" }
}
if (-not $SkipDocker) { Install-Tool 'Docker.DockerDesktop' }
if (-not $SkipDatabaseBrowser) { Install-Tool 'DBBrowserForSQLite.DBBrowserForSQLite' }
$desktop = Join-Path $env:ProgramFiles 'Docker/Docker/Docker Desktop.exe'
if (-not $SkipDocker -and (Test-Path $desktop) -and -not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    Start-Process $desktop
}
Write-Host 'Tools installed. Complete Docker Desktop WSL2 setup and restart Windows if requested.'
Write-Host 'Verify in a new terminal: docker version; docker compose version'
Write-Host 'Open DB Browser for SQLite, then Open Database: structural-platform/backend/laravel/database/database.sqlite'
