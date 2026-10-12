#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -d docs ] && [ ! -f docs/.geekcalculus-demo-build ]; then
  echo 'Refusing to replace docs without the generated-demo marker.' >&2
  exit 1
fi
docker run --rm --user "$(id -u):$(id -g)" -e VITE_DEMO_MODE=true -e VITE_BASE_PATH=/GeekCalculus/ \
  -v "$PWD:/repo" -w /repo/structural-platform/frontend/vue node:24-alpine \
  npm run build -- --outDir ../../../docs --emptyOutDir
touch docs/.nojekyll docs/.geekcalculus-demo-build
