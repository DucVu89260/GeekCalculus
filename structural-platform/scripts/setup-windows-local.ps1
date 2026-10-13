$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$ProjectRoot = (Get-Location).Path
function Check-DockerStep([string]$Description) {
    if ($LASTEXITCODE -ne 0) { throw "$Description failed. Check the Docker output above; existing data was not reset." }
}
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop with Linux containers / WSL2 first.' }
$ComposerImage = 'composer:2@sha256:af98f42dfff7c68ba8d53c2164fd9fde1087b7d449514baa38c418b1f6bc4bac'
docker run --rm --user '1000:1000' -e COMPOSER_HOME=/tmp/composer -v "${ProjectRoot}:/app" -w /app/backend/laravel $ComposerImage composer install --no-interaction --prefer-dist
Check-DockerStep 'Composer installation'
if (-not (Test-Path 'backend/laravel/.env')) { Copy-Item 'backend/laravel/.env.example' 'backend/laravel/.env' }
if (-not (Test-Path 'backend/laravel/database/database.sqlite')) { New-Item -ItemType File 'backend/laravel/database/database.sqlite' | Out-Null }
if (-not (Select-String -Path 'backend/laravel/.env' -Pattern '^APP_KEY=base64:' -Quiet)) {
    docker compose run --rm --no-deps backend php artisan key:generate --no-interaction
    Check-DockerStep 'Application key setup'
}
docker compose run --rm --no-deps backend php artisan migrate --seed --force --no-interaction
Check-DockerStep 'Database migration'
docker run --rm --user '1000:1000' -e npm_config_cache=/tmp/npm-cache -v "${ProjectRoot}:/app" -w /app/frontend/vue node:24-alpine npm ci --no-audit --no-fund
Check-DockerStep 'Frontend installation'
docker compose build section-engine
Check-DockerStep 'Section engine build'
docker compose up -d --wait
Check-DockerStep 'Application startup'
& (Join-Path $PSScriptRoot 'start-db-tools.ps1')
Write-Host 'Application: localhost:5173. Database UI: localhost:8080 (default ports).'
Write-Host 'Create your first administrator with the private password prompt:'
Write-Host 'docker compose exec backend php artisan app:create-user YOUR_EMAIL --role=admin --name=Administrator'
