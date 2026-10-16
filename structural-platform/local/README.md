# Local main and test domains

This is an opt-in local setup. It does not change public DNS, GitHub Pages, or the normal `docker compose up` workflow.

| Address | Frontend | Laravel data |
| --- | --- | --- |
| `http://geekcalculus.com` | Native production build in `frontend/vue/dist` | Existing `backend/laravel/database/database.sqlite` and storage |
| `http://geekcalculus.test` | Native Vite development server with HMR | Separate `local/test-data/database.sqlite` and `local/test-data/storage` |

Both use the existing section engine. Host-only session cookies have different names. Test accounts, sessions, private sources and SQLite data are not copied from main. Both use the same source checkout: edits appear immediately on test; main changes after a new build. Neither app uses the browser-only demo database.

## Start

Requirements: Docker Compose v2, Node 24/npm, Bash (Git Bash/WSL on Windows), an existing prepared default Compose stack (including the built section-engine image), and dependencies/app key initialized by `bash scripts/setup.sh`. Keep `.env` and the existing SQLite database.

On the machine running the browser, add this line to the hosts file with administrator rights:

```text
127.0.0.1 geekcalculus.com geekcalculus.test
```

Hosts file locations:

- Windows: `C:\Windows\System32\drivers\etc\hosts` (open the editor as Administrator).
- Linux/macOS: `/etc/hosts` (requires administrator rights).

These mappings affect only that machine. This setup uses **HTTP**; open the complete addresses above.

From `structural-platform`:

```sh
bash scripts/start-local-domains.sh
```

The script creates the test directory if needed, builds main with native API mode and `/` as the base path, and starts both apps behind an Nginx gateway bound to `127.0.0.1:80`. It does not modify the hosts file automatically. If port 80 is already occupied, stop the conflicting local server or set `LOCAL_WEB_PORT=8080` and include `:8080` in both URLs.

No account/password is generated. Existing main accounts remain usable. Create an account in the test database interactively:

```sh
docker compose -f compose.yaml -f compose.local-domains.yaml exec backend-test php artisan app:create-user your-email@example.com --role=admin --name="Test Administrator"
```

The command prompts for a private password. The corresponding main service is `backend`. Account changes on test do not change main accounts.

## Refresh, inspect and stop

Rerun `bash scripts/start-local-domains.sh` to rebuild main and restart services while preserving both databases. For backend `.env` or Compose environment changes, restart/recreate the affected backend: `artisan serve --no-reload` deliberately preserves its container's database/storage/session overrides.

```sh
docker compose -f compose.yaml -f compose.local-domains.yaml logs --tail=60 local-web backend backend-test frontend-test
docker compose -f compose.yaml -f compose.local-domains.yaml stop local-web frontend-test backend-test
```

Stop `backend`/`section-engine` separately if no other local workflows use them. Do not delete `local/test-data`, databases, or volumes to resolve startup errors. Keep private test data out of Git.

## Verification

With the services running, the smoke test connects to loopback with explicit Host headers and browser DNS overrides; it does not require editing the cloud machine's hosts file:

```sh
CHROMIUM_PATH=/path/to/chromium node tests/local-domains-smoke.cjs
```

It checks both native login pages, health/CSRF/guest APIs, distinct cookies, built-main versus Vite-test routing and unknown-host rejection. For an alternate gateway port, also set `LOCAL_WEB_PORT`. Browser dependency selection follows the other smoke scripts through `PLAYWRIGHT_MODULE`.
