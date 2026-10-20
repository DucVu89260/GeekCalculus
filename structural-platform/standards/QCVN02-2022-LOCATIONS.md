# QCVN 02:2022/BXD — Vietnamese location reference dataset

Source-reviewed implementation, 2026-10-20. This module looks up tabulated references; it does not calculate wind loads, site-adjusted seismic spectra or structural compliance.

## Artifact and tables

The user supplied the original PDF after the official host was unavailable from cloud networking. Read actual cover/foreword, definitions and tables. The document is QCVN 02:2022/BXD, issued with Circular 02/2022/TT-BXD dated 2022-09-26. Original PDF stays outside Git/Pages; source links point to the official URL.

- Official URL: https://datafiles.chinhphu.vn/cpp/files/vbpq/2022/10/02-bxd.pdf
- SHA-256: `12cce9e43ce7c4f5e143e62239d038f5499cd6c713ab832b2e15b4a962962bce`
- 18,811,938 bytes; 619 physical PDF pages. In the relevant tables, printed page = physical page − 1. Physical page 1 is the circular/signature page.

| Table | Physical PDF pages | Printed pages | Coverage |
| --- | --- | --- | --- |
| 5.1 | 43–64 | 42–63 | 334 geographic wind scopes across 63 province/municipality headings |
| 6.1 | 71–87 | 70–86 | 705 reference-ground-acceleration locations |
| 6.2 | 88–104 | 87–103 | 704 spectral source rows; one explicitly shared row serves two locations |

The resulting dataset has 705 earthquake location selections. It preserves each table's province labels, original locality strings and per-field source row/side/page. IDs are edition-scoped dataset identifiers, not official administrative codes. It retains the source's 2022 geography; no post-merger mapping or inferred nearest-location values.

## Definitions and units

| Parameter | Stored/display unit | Source conditions | Definitions, physical PDF pages |
| --- | --- | --- | --- |
| Wind zone | I–V | Geographic scope exactly as printed, including communes/exceptions | 39; Table5.1 |
| W0 | daN/m² | 3-second wind, 20-year return period, 10 m, terrain B | 39–40, 5.2 |
| V3s,50 | m/s | 3-second wind, 50-year return period, 10 m, terrain B | 40, 5.3 |
| V10min,50 | m/s | 10-minute wind, 50-year return period, 10 m, terrain B | 40–41, 5.4 |
| agR | g | Ground A, 500-year reference return period | 66, 6.1 |
| SS | g | T=0.2 s, ground B, 2,500-year earthquake, 5% damping | 66–67, 6.2 |
| S1 | g | T=1 s, ground B, 2,500-year earthquake, 5% damping | 66–67, 6.2 |

The source defines g=9.81 m/s². No importance/site/exposure/topographic factors, probability/return-period conversions or design combinations are applied. In particular W0 and the two tabulated wind velocities do not share the same averaging/return-period basis and are not derived from one another here.

Wind scopes can divide a district by commune or describe all districts except named exceptions. The UI therefore requires an explicit source-scope selection for wind, independently of the earthquake locality selection. It does not assign a district-wide wind value from a partial match. JSON marks these as independent selections and carries the full original wind scope.

## Reviewed source exceptions

1. **Vinh SS, physical98/printed97:** the original cell says `0,38`, without `×g`. Visually confirmed. Retain raw text, `value_g=null`, `status=source_unit_missing` and a visible VI/EN note. S1 and agR remain available from their respective source cells. Do not manufacture a unit-bearing SS value or replace it with zero.
2. **Từ Sơn:** Table6.1 says `Thành phố Từ Sơn`; Table6.2 says `Thị xã Từ Sơn`. An explicit edition-local mapping preserves both labels and flags the difference. This is not a general city/town alias rule.
3. **Duyên Hải:** Table6.1 has separate town/district rows; Table6.2 explicitly groups `Thị xã, huyện Duyên Hải`. Both selections refer to that same spectral source row and show a shared-scope note. Neither source row is dropped or synthesized.
4. **Phan Rang–Tháp Chàm and Bác Ái:** spacing around the dash/accent spelling differs across tables. Normalized full-name matches within the same source province preserve original labels and visible notes. Province spellings also differ (Đắk/Đăk and a dash in Thừa Thiên Huế); all table-specific province labels are retained.
5. **Physical71/printed70:** the original page header says `QCVN 02:2020/BXD`, despite this being the supplied 2022 document. The source note preserves that discrepancy; the dataset's edition comes from the cover/foreword, not that isolated header.

## Reproduction and independent checks

From `structural-platform`, with original PDF at a private path:

```sh
python -m pip install -r scripts/requirements-location-verification.txt
python scripts/extract_qcvn02_locations.py /private/02-bxd.pdf --output /tmp/qcvn02-locations.json
python scripts/verify_qcvn02_locations.py /private/02-bxd.pdf /tmp/qcvn02-locations.json
```

The extractor checks the exact SHA/edition/page count, accepts only reviewed row layouts and acceleration cells, checks all 63 province headings for each table, verifies fixed coverage counts and refuses unrecognized cross-table joins. It uses PyMuPDF table extraction (existing source requirements). Verification uses **pdfplumber independently**, comparing all location/value cells, source row identities and province headings against the published dataset. Completed: **1,743 unique source rows agree** (334+705+704). Runtime used PyMuPDF1.26.6 and pdfplumber0.11.9; repository source requirements pin PyMuPDF1.26.7. Semantic rows/pages/counts are the contract, not a table-finder's floating geometry.

Rendered source pages were reviewed for definitions, split wind scopes, first/continuation/final rows, the missing Vinh unit and the Duyên Hải shared row. Independent Node fixtures transcribe values from physical43/44/71/72/88/89/103/104, including Hà Nội, Củ Chi, Bạch Long Vĩ, Vĩnh Lộc and Yên Bình. They also test source distinctions, unique paths, missing values, scoped search, page bounds, export rejection of mixed provinces and immutable snapshots. Matching unit tests: 6 passed.

Vue typecheck and native/demo production builds passed. The targeted browser smoke passes demo mode with the existing demo login/catalog and native mode with a **synthetic read-only session**, not a real Laravel authentication test. It checks Library entry, active parent nav, deep-link/reload, all province options, wind qualification, values/definitions/units/source pages, accent-free search, reset behavior, VI/EN JSON parity, source-unit omission, shared-source notes and 320/390px overflow. Desktop/mobile screenshots were inspected. Existing large PDF-reader chunk warning remains; no source PDF was added to public assets.

```sh
cd frontend/vue
node --test tests/geometry/vietnam-location.test.js
npm run typecheck
VITE_DEMO_MODE=true VITE_BASE_PATH=/GeekCalculus/ npm run build -- --outDir /tmp/geek-vietnam-demo --emptyOutDir
```

Browser command from repository root (serve the respective build first):

```sh
TEST_DEMO=1 VN_BASE_URL=http://127.0.0.1:8821/GeekCalculus/ node structural-platform/tests/vietnam-location-smoke.cjs
TEST_DEMO=0 VN_BASE_URL=http://127.0.0.1:8822/ node structural-platform/tests/vietnam-location-smoke.cjs
```

The main npm test glob includes the six new tests. No Laravel migration/catalog mutation or unrelated engine changes were needed. Publication/CI evidence is tracked separately in Handoff.
