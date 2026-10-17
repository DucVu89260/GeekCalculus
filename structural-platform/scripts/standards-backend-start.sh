#!/bin/sh
set -eu
cd /app/backend/laravel
if [ ! -f vendor/autoload.php ]; then
  echo 'Install Laravel dependencies before starting the standards backend.' >&2
  exit 1
fi
if [ ! -f .env ]; then cp .env.example .env; fi
if ! grep -q '^APP_KEY=base64:' .env; then php artisan key:generate --no-interaction; fi
php artisan migrate --seed --force --no-interaction
# Laravel's development reloader discards container-provided DB_* variables.
# Keep the PostgreSQL runtime configuration in the child HTTP server.
exec php artisan serve --host=0.0.0.0 --port=8000 --no-reload
