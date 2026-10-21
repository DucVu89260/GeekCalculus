# Personal PDF notes — 2026-10-21

Entry: **Loading → Library → Personal PDF notes**, `#/modules/loads/library/notes`.
PDFs are personal reading documents, separate from standards verification and engineering calculation inputs. Upload, read with PDF.js/page navigation, search metadata, edit title/description, download the unchanged original and delete with confirmation. VI/EN and mobile layouts are supported.

## Native Laravel / local Docker

- Additive migration `2026_10_21_090000_create_personal_pdf_notes.php`: UUID note ID, user FK, title/description, original filename, size/SHA-256, private path and timestamps. No seed/reset or database engine change.
- Files live at `structural-platform/backend/laravel/storage/app/private/personal-pdf-notes/{user_id}/`, already covered by Compose's project bind mount. Existing SQLite remains `backend/laravel/database/database.sqlite`. Container restarts retain both. App files are not stored in a container image or public directory.
- `/api/v1/personal-pdf-notes`: GET list, POST multipart upload; `/{id}` PATCH details / DELETE; `/{id}/file` GET inline, `?download=1` for attachment. Existing web/session/auth/CSRF middleware applies. Every operation scopes the authenticated user, including admins; a client cannot supply an owner or storage path. File responses are private/no-store, PDF MIME, nosniff and sandboxed. Random filenames never use the uploaded path.
- File extension/MIME/header/size and metadata are validated server-side. Cap20MB, reduced to PHP's actual upload/post limit; list metadata reports the limit shown by the UI. No parser/extraction job runs on upload. A damaged PDF can still be saved if it passes file validation; reader failure stays explicit, and the original can be downloaded/deleted.
- Failed DB inserts remove newly written files. Delete stages the file until DB commit, restoring on DB failure; unsuccessful post-commit trash cleanup is logged and stays private. Account removal cascades metadata and removes that user's note directory after commit, so rolled-back account deletion retains files.

After pulling code on an already-running local installation:

```sh
cd structural-platform
docker compose exec -T backend php artisan migrate --force
```

The existing backend startup also runs additive migrations. Refresh the frontend after pulling. No engine rebuild, fresh migration or volume deletion is needed.

**Backup:** stop backend writes and back up the complete SQLite database (including any WAL/SHM files), `.env`/APP_KEY and `backend/laravel/storage/app/private/personal-pdf-notes/` together. Restore them together; DB metadata alone does not contain PDF bytes. Existing library JSON export does not include personal PDFs. Download original PDFs from each note for an additional portable copy.

## GitHub Pages demo

Pages has no Laravel server. `personal-pdf-notes.js` stores original File/Blob bytes and metadata atomically in IndexedDB (`geekcalculus-personal-pdf-notes`, version1), partitioned by the current demo account ID. No PDF is sent to GitHub or silently synced to Docker. Reopening the browser using the same profile/origin retains documents; clearing site data, a different profile/domain or browser eviction can remove them. Download originals as backups and upload them in local Docker when moving there.

Demo account partitioning is UI behavior, not server security: a person controlling this browser's storage/devtools can read local data. Native ownership checks are independent and authoritative. Quota/storage failures are visible and keep the unsaved form/file available to retry. No original supplied PDF is committed, seeded into a public bundle or copied into `public/`/root `docs/`.

## Verification

- Docker PHP8.4 image, explicit disposable SQLite `:memory:`: `PersonalPdfNotesTest` and `AuthLibraryTest`,22 passed/203 assertions. Covers guest and cross-user/admin rejection, immutable originals/Unicode download names, injection/validation, insertion cleanup, deletion rollback, account deletion rollback/after-commit cleanup. Auth tests use fake private storage so test user deletion cannot remove real notes.
- Native real session/CSRF/multipart upload, DB and private file storage, original checksum downloads and owned-container restart. Demo real IndexedDB/browser-profile restart and account switching. Both exercised the two privately supplied PDFs (17/2 pages), actual canvas rendering/page navigation, metadata edit/search/reload, delete confirmation, VI/EN and320/390px. The supplied files remain outside Git and are acceptance fixtures, not preloaded notes in another user's account/browser.
- Vue typecheck, native and demo production builds; existing Vietnam/Loading browser smoke. PDF viewer labels/download filename props are opt-in; standards callers keep their existing defaults. No formulas or standards source data changed.

Browser smoke requires a JSON array of two private fixtures `{ "path": "/absolute/path.pdf", "title": "Title", "pages": 17 }` (use PDFs with at least2 pages for the next-page check), plus private account fixtures in native mode. Run only against a disposable native server/database; the test adds/edits/deletes its own notes. `NOTES_RESTART_CONTAINER` must name an owned disposable test container.

```sh
PDF_NOTE_FIXTURES=/tmp/private-pdf-fixtures.json TEST_DEMO=1 NOTES_BASE_URL=http://127.0.0.1:8821/GeekCalculus/ node structural-platform/tests/personal-pdf-notes-smoke.cjs
PDF_NOTE_FIXTURES=/tmp/private-pdf-fixtures.json AUTH_FIXTURES=/tmp/private-accounts.json TEST_DEMO=0 NOTES_BASE_URL=http://127.0.0.1:8871/ node structural-platform/tests/personal-pdf-notes-smoke.cjs
```
