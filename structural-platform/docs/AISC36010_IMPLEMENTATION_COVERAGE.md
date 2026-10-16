# AISC 360-10 implementation coverage — 2026-10-16

This report covers the Phase A/B extension of the existing GeekCalculus Standards Library, plus a limited source-backed correction to the symmetric I/H reference solver. It separates source indexing, transcription and engineering approval.

## Result and actual runtime

The feature was executed in an isolated PostgreSQL 17 / PHP 8.4 / Python / Vue environment using the supplied private PDF. The existing application's SQLite database and original containers were preserved. No public/production deployment or merge into `main` is claimed. GitHub Pages has no private Laravel database/PDF; it cannot demonstrate the private-source reader by itself.

The reader follows **Steel Structure → Steel Library → Design Standard → AISC 360-10**, opens a new browser tab, loads the database automatically and has no PDF/JSON upload control. Other standards remain Coming Soon in this registry. Existing Loading, Wind, Combo Generator, SectionalProperties and bilingual I/H pages are retained.

## Source indexing and transcription

| Measure | Actual result |
| --- | --- |
| Supplied source | `AISC-360-10.pdf`, 4,908,523 bytes |
| SHA-256 | `f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99` |
| Physical pages / native bookmarks | 612 / 231 |
| Measured Specification / Commentary | 57–296 / 297–608 |
| Heading/anchor rows | 787: 448 normative, 334 commentary, 5 other |
| Equation identifier candidates | 508: 385 normative, 123 commentary |
| Table identifier candidates | 26 |
| Transcribed equation review drafts | 26; all `needs_review` |
| Typed parameter review drafts | 9; all `needs_review` |
| Partial B4 tables | 2; seven selected I/H cases; all `needs_review` |
| Newly verified/published database equations | **0** |

The extractor scans the whole source and indexes detected headings, chapters A–N, appendices, front matter and Commentary. It measures boundaries and reads printed page labels, rather than assuming offsets or accepting misleading J–N bookmarks. Candidate identifiers can be references instead of equation definitions. These counts do not prove complete heading recall, complete digitization, table reconstruction or engineering compliance. Ambiguous candidates retain source evidence and no invented formula/cell values.

Draft equations: E3-1–4, E4-4, F1-1, F2-1–7, F3-1/2, F4-11/12, F5-3/4, G2-1–5, H1-1a/b. B4.1a cases 1/2/5 and B4.1b cases 10/11/13/15 have partial row/column/footnote/applicability coverage; the full tables and source diagrams are not reconstructed.

## Changes and migration plan

| Area | Principal files |
| --- | --- |
| Private inspection and content indexing | `scripts/extract_standard_outline.py`, `scripts/standards-editions.json`, `scripts/tests/test_standard_outline.py` |
| Existing import commands | `backend/laravel/app/Console/Commands/ImportStandardPdf.php`, `ImportStandardsOutline.php`; new `ImportStandardsReviewDrafts.php` |
| Ingestion, cache and review services | `backend/laravel/app/Services/Standards/` |
| Read/admin API and guest JSON handling | `StandardsController.php`, `StandardsReviewController.php`, `routes/api.php`, `bootstrap/app.php`, `config/standards.php`, `StandardsSeeder.php` |
| Additive migrations | `2026_10_16_000002_extend_standards_registry_for_source_versions.php`, `2026_10_16_000003_add_standard_equation_source_kind_unique.php` |
| Reader components | `StandardsExplorer.vue`, `StandardsToc.vue`, `PrivateStandardPdf.vue`, `StandardEquation.vue`, `StandardTable.vue`; lazy loading in `ModuleHub.vue` |
| Source review drafts and audit | `standards/aisc360-10-review-drafts.json`, `standards/AISC36010_SOURCE_AUDIT_2026.md` |
| Narrow solver correction | `standards/aisc360-10-verified-hi.mjs`, `frontend/vue/tests/geometry/aisc36010-source-errata.test.js` |
| Optional persistent PostgreSQL runtime | `compose.standards.yaml`, `docker/backend/Dockerfile`, `scripts/standards-backend-start.sh` |
| Browser coverage | `tests/standards-explorer-smoke.cjs`, `tests/standards-private-source-smoke.cjs` |
| Deployment/rollback | `docs/AISC36010_PRIVATE_IMPORT.md` |

The migrations extend existing standards tables and introduce typed parameters, table records and review history. JSONB is used for new PostgreSQL JSON fields. Source-context uniqueness permits new document revisions and distinguishes Specification from Commentary. Legacy rows without a source document remain intact; conflicting source IDs fail rather than silently deleting records. Back up existing data before migration; no automatic SQLite-to-PostgreSQL migration is performed.

## Completed behavior

- Content-addressed private PDF registration, actual-file inspection, hash/identity checks, structured report, idempotence, transactional DB writes and storage cleanup on failure.
- Versioned provenance with document ID/hash/revision, physical/printed pages, source anchors, extraction method, review status and protected approved records.
- Authenticated paginated/searchable clause/equation/parameter/table APIs, response-cache invalidation, private PDF serving with integrity checks, per-user notes and admin-only review/edit/history APIs.
- Candidate → needs_review → verified → published lifecycle, source/completeness validation, evidence notes and historical snapshots. Approval remains a human engineering responsibility.
- Approved-only rule lookup by equation/implementation/parameter key and ASD/LRFD method. Candidates and drafts never enter execution responses.
- Expandable TOC, Specification/Commentary filter, selected-clause/source synchronization, exact PDF.js physical-page rendering, measured printed labels, KaTeX equations, typed parameters, partial tables, review toggle, private notes and responsive EN/VI controls.

## B4 / E / F / G / H engineering scope

| Group | Source review and delivered check | Remaining validation / implementation |
| --- | --- | --- |
| B4 | Seven I/H cases transcribed with conditions and sources; compression/flexure and rolled/built-up cases kept distinct. | Independent classification examples, fillet-aware rolled geometry, bolted-web dimensions, remaining cases and table diagrams. |
| E | E3/E4 expressions and factors checked against source; existing regression suite retained; formula-level E7 comparison added. | Independent published compression/E7 examples, full applicability review and singly symmetric torsional/flexural-torsional coverage. |
| F | F4-11 source uses clear web `h²`, not overall `d²`; corrected to represented welded-I `hc²`. Independent F5-3/F5-4 nominal/ASD/LRFD fixtures include rectangle-derived consistent A/I/S/Z. Noncompact-web label corrected to F4. | F4 noncompact-web strength stays blocked; rolled F5 geometry and full independent branch benchmarks remain open. |
| G | G2-1–5 and factors transcribed as review drafts, with the G2.1(a) rolled-I exception kept separate. | No new G2/G3 shear, stiffener or tension-field engine. Source-reviewed drafts are not implementation approval. |
| H | H1-1a/b transcribed and existing interaction regression retained. | Independent interaction examples and reviewed input strengths; H1-2 alternative/H2–H4 not added; tension awaits D2/D3. |

The original global `REVIEW_REQUIRED` barrier remains. Singly symmetric I/H must not be treated as the doubly symmetric reference solver. No existing design calculation is connected to unapproved database extraction. The F4-11 correction follows visual source review and independent constants, not parser output. No published AISC worked example is claimed for the hand-calculated fixtures.

## Executed checks

- Python synthetic PDF indexing: **8 passed**, including shifted pagination, wrong bookmarks, identity/edition rejection, namespace/appendix identifiers and no fabricated equations/table cells.
- Node 24 engineering/geometry regressions: **84 passed**, including three new source-errata cases.
- Laravel backend: **67 passed / 625 assertions** on SQLite and on a separate disposable PostgreSQL test database (final response-metadata assertions included).
- Vue TypeScript checking and production build: passed. The reader is loaded on demand. Vite reports a large reader chunk; this is a performance follow-up, not a failed build.
- Synthetic browser smoke: passed hierarchy/search/filter, math fractions, exact page selection, partial/empty tables, review toggle, notes and Coming Soon behavior.
- Actual-source PostgreSQL browser smoke: passed new-tab navigation, real PDF SHA, guest denial, E3 math, F4-11 physical page 108 / printed 16.1-52, source synchronization, draft exclusion and mobile widths 390/320.
- Real PDF and review-draft import/re-import executed successfully. One source registration, 787 clauses, 508 equation IDs, 9 parameters and 26 table records; zero newly approved rules.

The private-source browser test deliberately requires external private credentials/source provisioning. The original PDF and real-source fixtures are absent from Git. CI exercises synthetic PDFs and public mathematical fixtures.

## Remaining work and release gate

Phase A/B is implemented and tested; subsequent engineering verification remains partial. The admin workflow is available through authorized APIs; a full visual admin approval editor is a follow-up. Table merged-cell semantics are stored, but full complex-table reconstruction/rendering is not claimed. Indexed clauses have source titles, not a manually translated full standard or complete technical summaries.

Approval of the 26 equation drafts/9 parameters/2 partial tables, independent published engineering examples, additional limit-state solvers and production private-artifact provisioning remain required. Preserve calculation references when superseding a source or rule. Do not merge unreviewed engineering behavior or label this implementation fully AISC 360-10 compliant.

See the feature PR for commit links and final check results. Operational setup and rollback are in [AISC36010_PRIVATE_IMPORT.md](AISC36010_PRIVATE_IMPORT.md); detailed formula evidence is in [the source audit](../standards/AISC36010_SOURCE_AUDIT_2026.md).
