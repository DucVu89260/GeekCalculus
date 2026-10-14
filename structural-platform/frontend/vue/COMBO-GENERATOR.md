# Loading / Combo Generator

Route: `#/modules/loads/combo` in the Vue frontend.

The module embeds the existing v5 Excel-style matrix editor via
`public/combo-generator-v5.html?embed=1`. The sheet retains 31 Load
Patterns and 1,646 imported combinations, pattern deletion, template
management, seismic factors, JSON import/export, and SAP2000 new-model S2K export.

## Laravel integration

`ComboGeneratorView.vue` exchanges state with the same-origin editor iframe
using postMessage. Authenticated endpoints:

- `GET /api/v1/combo-generator/workspace`: load the account's saved matrix.
- `PUT /api/v1/combo-generator/workspace`: save a validated JSON payload.

Migration: `php artisan migrate`. Backend test:
`php artisan test --filter=ComboGeneratorWorkspaceTest`.

This is explicit save/restore, not autosave. Keep independent JSON backups.
Workspaces are scoped to individual Laravel users.

## Demo deployment

GitHub Pages is frontend-only; Laravel storage buttons are hidden in demo
mode. After merge, the GitHub Actions workflow builds the Vue app into
`docs/` for GitHub Pages. The deployed route stays the same.

## SAP2000 limitations

The new-model S2K file defines Load Patterns, Linear Static Load Cases
and Load Combinations. It does not connect to a running SAP2000 instance,
read existing model definitions, resolve naming conflicts, or apply loads
to structural objects. Windows SAP2000 import testing remains necessary.
