#!/bin/sh
set -eu
cd /app/backend/laravel
: "${DB_DATABASE:?Test database path is required}"
case "$DB_DATABASE" in /test-data/*) ;; *) echo 'Refusing to use a non-test database.' >&2; exit 1;; esac
mkdir -p /test-data/storage/app/private /test-data/storage/app/public \
  /test-data/storage/framework/cache/data /test-data/storage/framework/sessions \
  /test-data/storage/framework/views /test-data/storage/logs
if [ ! -f "$DB_DATABASE" ]; then touch "$DB_DATABASE"; fi
php artisan migrate --seed --force --no-interaction
exec php artisan serve --host=0.0.0.0 --port=8000 --no-reload
