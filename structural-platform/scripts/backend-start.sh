#!/bin/sh
set -eu
cd /app/backend/laravel
if [ ! -f vendor/autoload.php ]; then
  echo 'Dependencies missing: run bash scripts/setup.sh from structural-platform.' >&2
  exit 1
fi
if [ ! -f .env ]; then cp .env.example .env; fi
if ! grep -q '^APP_KEY=base64:' .env; then php artisan key:generate --no-interaction; fi
if [ ! -f database/database.sqlite ]; then touch database/database.sqlite; fi
php artisan migrate --seed --force --no-interaction
exec php artisan serve --host=0.0.0.0 --port=8000
