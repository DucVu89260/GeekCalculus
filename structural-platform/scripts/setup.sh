#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"
composer_image='composer:2@sha256:af98f42dfff7c68ba8d53c2164fd9fde1087b7d449514baa38c418b1f6bc4bac'
cert_args=()
node_cert_args=()
# Reuse the machine's CA bundle, including managed proxy trust; TLS stays verified.
if [ -f /etc/ssl/certs/ca-certificates.crt ]; then
  cert_args=(-v /etc/ssl/certs/ca-certificates.crt:/certs/ca-certificates.crt:ro -e COMPOSER_CAFILE=/certs/ca-certificates.crt)
  node_cert_args=(-v /etc/ssl/certs/ca-certificates.crt:/certs/ca-certificates.crt:ro -e NODE_EXTRA_CA_CERTS=/certs/ca-certificates.crt)
fi
docker run --rm --user "$LOCAL_UID:$LOCAL_GID" -e COMPOSER_HOME=/tmp/composer "${cert_args[@]}" \
  -v "$PWD:/app" -w /app/backend/laravel "$composer_image" composer install --no-interaction --prefer-dist
if [ ! -f backend/laravel/.env ]; then cp backend/laravel/.env.example backend/laravel/.env; fi
if [ ! -f backend/laravel/database/database.sqlite ]; then touch backend/laravel/database/database.sqlite; fi
if ! grep -q '^APP_KEY=base64:' backend/laravel/.env; then docker compose run --rm --no-deps backend php artisan key:generate --no-interaction; fi
docker compose run --rm --no-deps backend php artisan migrate --seed --force --no-interaction
docker run --rm --user "$LOCAL_UID:$LOCAL_GID" -e npm_config_cache=/tmp/npm-cache "${node_cert_args[@]}" \
  -v "$PWD:/app" -w /app/frontend/vue node:24-alpine npm ci --no-audit --no-fund
printf 'Setup complete. Start with: docker compose up -d\n'
