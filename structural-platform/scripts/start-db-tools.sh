#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -s backend/laravel/database/database.sqlite ]; then
  echo 'Existing SQLite database missing. Run bash scripts/setup.sh and start the backend first.' >&2
  exit 1
fi
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"
mkdir -p backend/laravel/storage/app/private/database-backups
chmod 700 backend/laravel/storage/app/private/database-backups
docker compose -f compose.db-tools.yaml up -d --wait
printf 'SQLite Web ready on loopback port %s. Startup backup saved under storage/app/private/database-backups.\n' "${DB_TOOLS_PORT:-8080}"
