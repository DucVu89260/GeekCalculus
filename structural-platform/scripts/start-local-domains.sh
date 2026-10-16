#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"
if [ ! -f backend/laravel/vendor/autoload.php ] || [ ! -d frontend/vue/node_modules ]; then
  echo 'Install dependencies first: bash scripts/setup.sh' >&2
  exit 1
fi
if [ ! -f backend/laravel/.env ]; then
  echo 'Initialize Laravel first: bash scripts/setup.sh' >&2
  exit 1
fi
if ! grep -q '^APP_KEY=base64:' backend/laravel/.env; then
  echo 'Initialize APP_KEY first: bash scripts/setup.sh' >&2
  exit 1
fi
mkdir -p local/test-data
# Use the same Node runtime as Compose; no host Node/npm installation is required.
node_cert_args=()
if [ -f /etc/ssl/certs/ca-certificates.crt ]; then
  node_cert_args=(-v /etc/ssl/certs/ca-certificates.crt:/certs/ca-certificates.crt:ro -e NODE_EXTRA_CA_CERTS=/certs/ca-certificates.crt)
fi
docker run --rm --user "$LOCAL_UID:$LOCAL_GID" \
  -e VITE_DEMO_MODE=false -e VITE_BASE_PATH=/ -e npm_config_cache=/tmp/npm-cache \
  "${node_cert_args[@]}" -v "$PWD:/app" -w /app/frontend/vue node:24-alpine npm run build
# Only generated public output is made readable by the Nginx worker.
chmod -R a+rX frontend/vue/dist
docker compose -f compose.yaml -f compose.local-domains.yaml up -d --no-build --wait --wait-timeout 120 \
  section-engine backend backend-test frontend-test local-web
printf 'Main: http://geekcalculus.com\nTest: http://geekcalculus.test\n'
printf 'On the browser machine, hosts must contain: 127.0.0.1 geekcalculus.com geekcalculus.test\n'
