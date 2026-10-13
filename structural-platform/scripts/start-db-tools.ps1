$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (-not (Test-Path 'backend/laravel/database/database.sqlite') -or (Get-Item 'backend/laravel/database/database.sqlite').Length -eq 0) {
    throw 'Existing SQLite database missing. Run application setup first. No empty database was created.'
}
New-Item -ItemType Directory -Force 'backend/laravel/storage/app/private/database-backups' | Out-Null
docker compose -f compose.db-tools.yaml up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Database UI startup failed. Run docker compose -f compose.db-tools.yaml logs database-ui.' }
Write-Host 'SQLite Web ready on localhost:8080 (or DB_TOOLS_PORT). Startup backup saved in storage/app/private/database-backups.'
