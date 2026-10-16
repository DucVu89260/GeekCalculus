# Local main and test domains

This is an opt-in local setup. It does not change public DNS, GitHub Pages, or the normal `docker compose up` workflow.

| Address | Frontend | Laravel data |
| --- | --- | --- |
| `http://geekcalculus.com` | Native production build in `frontend/vue/dist` | Existing `backend/laravel/database/database.sqlite` and storage |
| `http://geekcalculus.test` | Native Vite development server with HMR | Same main SQLite database and `storage/app`; separate test sessions/cache/logs |

Every HTML page on `geekcalculus.test` displays a fixed **Test** label at the bottom left, including standalone calculators. The app and standalone pages load the hostname-guarded marker themselves, with gateway injection as a fallback; embedded frames defer to the outer page. An old gateway configuration does not prevent the app from showing the label after a refresh. Main never receives the marker.

**Both websites share the existing main database, accounts, standards records and document storage. Changes from test affect main data too.** Main alone runs the ordinary additive migrations; test waits for main and never resets or seeds the shared database. Host-only session cookies have different names, and test sessions/cache/logs stay in `local/test-data/storage`. The former `local/test-data/database.sqlite` and any test-only files are retained without deletion or automatic merging, but that old database is no longer used. Both use the same source checkout: edits appear immediately on test; main changes after a new build. Neither app uses the browser-only demo database.

## Start

Requirements: Docker Compose v2, Bash (Git Bash/WSL on Windows), an existing prepared default Compose stack (including the built section-engine image), and dependencies/app key initialized by `bash scripts/setup.sh`. Keep `.env` and the existing SQLite database. The script builds using the `node:24-alpine` container; Node/npm is not required on Ubuntu/WSL itself.

On the machine running the browser, add this line to the hosts file with administrator rights:

```text
127.0.0.1 geekcalculus.com geekcalculus.test
```

The mapping must not start with `#` (that makes it a comment). Enter it without surrounding quotation marks.

Hosts file locations:

- Windows: `C:\Windows\System32\drivers\etc\hosts` (open the editor as Administrator).
- Linux/macOS: `/etc/hosts` (requires administrator rights).

If Docker runs in Ubuntu/WSL and the browser runs on Windows, edit the **Windows** hosts file. Edit `/etc/hosts` as well if you also want to resolve these names from Ubuntu.

These mappings affect only that machine. This setup uses **HTTP**; open the complete addresses above.

From `structural-platform`:

```sh
bash scripts/start-local-domains.sh
```

The script creates the test directory if needed, builds main with native API mode and `/` as the base path, and starts both apps behind an Nginx gateway bound to `127.0.0.1:80`. It does not modify the hosts file automatically. If port 80 is already occupied, stop the conflicting local server or set `LOCAL_WEB_PORT=8080` and include `:8080` in both URLs.

Use the **same existing main credentials** to log in on either domain. Login sessions remain independent. No account/password is generated or copied.

The Test label identifies the UI/runtime, not an isolated data sandbox. Automated database-mutating tests must use an explicitly disposable database such as `DB_CONNECTION=sqlite DB_DATABASE=:memory:`; never point them at either running app's shared database.

## Refresh, inspect and stop

Rerun `bash scripts/start-local-domains.sh` to rebuild main and restart services while preserving shared data and the former test-only files. For backend `.env` or Compose environment changes, restart/recreate the affected backend: `artisan serve --no-reload` deliberately preserves its container's database/storage/session overrides.

```sh
docker compose -f compose.yaml -f compose.local-domains.yaml logs --tail=60 local-web backend backend-test frontend-test
docker compose -f compose.yaml -f compose.local-domains.yaml stop local-web frontend-test backend-test
```

Stop `backend`/`section-engine` separately if no other local workflows use them. Do not delete `local/test-data`, databases, or volumes to resolve startup errors. Keep private test data out of Git.

If you have pulled changes but still do not see **Test**, rerun the startup script (it reloads Nginx) and use **Ctrl + F5** on `http://geekcalculus.test`.

## Verification

With the services running, the smoke test connects to loopback with explicit Host headers and browser DNS overrides; it does not require editing the cloud machine's hosts file:

```sh
CHROMIUM_PATH=/path/to/chromium node tests/local-domains-smoke.cjs
```

It checks both native login pages, health/CSRF/guest APIs, distinct cookies, built-main versus Vite-test routing and unknown-host rejection. For an alternate gateway port, also set `LOCAL_WEB_PORT`. Browser dependency selection follows the other smoke scripts through `PLAYWRIGHT_MODULE`.
