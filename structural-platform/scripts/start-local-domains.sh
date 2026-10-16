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
# Explicit native mode and root base; keep the GitHub Pages build separate.
(cd frontend/vue && VITE_DEMO_MODE=false VITE_BASE_PATH=/ npm run build)
# Only generated public output is made readable by the Nginx worker.
chmod -R a+rX frontend/vue/dist
docker compose -f compose.yaml -f compose.local-domains.yaml up -d --no-build --wait --wait-timeout 120 \
  section-engine backend backend-test frontend-test local-web
printf 'Main: http://geekcalculus.com\nTest: http://geekcalculus.test\n'
printf 'On the browser machine, hosts must contain: 127.0.0.1 geekcalculus.com geekcalculus.test\n'
