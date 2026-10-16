#!/bin/sh
set -eu
cd /app/backend/laravel
# Main owns shared-database initialization and migrations; test must never reset it.
if [ "${DB_DATABASE:-}" != /app/backend/laravel/database/database.sqlite ] || [ ! -f "$DB_DATABASE" ]; then
  echo 'The shared main database must be initialized by the backend service first.' >&2
  exit 1
fi
mkdir -p /test-data/storage/framework/cache/data /test-data/storage/framework/sessions \
  /test-data/storage/framework/views /test-data/storage/logs
exec php artisan serve --host=0.0.0.0 --port=8000 --no-reload
