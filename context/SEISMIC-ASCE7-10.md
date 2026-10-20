# Seismic Load 01–06 — Issue #25

Implemented on `feature/seismic-load-asce7-10`, based on updated main and the 2026-10-20 [specification](../docs/seismic-load-asce7-10-implementation.md). This durable document lives outside generated Pages `docs/`. Draft PR only; no merge/deployment implied.

## Runtime and workflow

Open Loading → Seismic load (`#/modules/loads/seismic`) in the **native Laravel/Vite application**. Run the normal additive `php artisan migrate --force`; do not reset or reseed existing data. PHP needs ZipArchive and SimpleXML (present in the repository Composer runtime). No new dependency or lockfile changes.

01 project/site, 02 spectrum, 03 independent UX/UY systems, 04 SAP Mass Source, 05 ELF, 06 RS comparison are functional. 07 drift/P-Delta, 08 reports/export and 09 QA/review UI are Coming Soon. An immutable calculation snapshot is available through the authenticated run endpoint; this is not a full report feature.

GitHub Pages has no Laravel/PHP runtime. It displays the UI with an explicit native-application requirement; calculations/uploads are disabled instead of returning fake demo results. Native application functionality does not establish Pages calculation support. There is one numerical implementation, in PHP, not a duplicated browser kernel.

## Source and engineering contract

Versioned coefficient source: `structural-platform/standards/asce7-10-seismic-v1.json`. Exact edition ASCE 7-10, SHA-256 `ae2997f7a31975965b33065ba54acbf4da441f4f821b2a97372d67c2bd1ca248` (existing 658-page artifact). Physical/printed pages verified against source:

| Branch | Source | Physical / printed page | Implemented conditions |
| --- | --- | --- | --- |
| Fa/Fv | Tables 11.4-1/2 | 109 / 66 | All A–E rows, endpoint clamping per ≤/≥ columns, straight-line interpolation; F blocked for site-specific study |
| Spectrum/SDC | §11.4.4–7, Tables 11.6-1/2 | 108–110 / 65–67 | SMS, SM1, SDS, SD1, T0, Ts, TL, four spectral branches; governing SDC including S1 ≥ .75; generic spectrum blocked for flagged site-specific/isolation/damping conditions |
| SFRS | Table 12.2-1 | 116–118 / 73–75 | B1/B2/B3/B25, C1/C3/C4/C5/C6/C7; coefficients and tabulated height/prohibition limits; no automatic footnote exceptions |
| Period | Tables 12.8-1/2; Eq 12.8-7 | 133 / 90 | Cu interpolation, Ct/x in feet, Ta, CuTa cap, independent modal periods; frame-specific Ct requires eligibility confirmation, otherwise “all other” |
| ELF | §12.8.1.1, Eqs 12.8-1…6 | 132–133 / 89–90 | Short, intermediate/long-period upper branches; .044 SDS Ie and .01 minimums; conditional S1 ≥ .6 minimum; no optional Ss cap or SSI reduction |
| RS | §12.9.4.1 | 137 / 94 | 85% capped-period ELF force threshold; exact case/row and signed global axis; raw versus already-scaled audit; no repeated scaling |
| Site | §20.1–20.4, Table 20.3-1 | 246–248 / 203–205 | Complete continuous 0–30m N/Vs harmonic profiles; N field values capped at 100 **without corrections**, as §20.4.2 states; N cannot establish rock A/B; F/soft-clay E screening; A/B geotechnical confirmation |

Other Table 12.2-1 systems/exceptions are explicitly pending review, unavailable for automatic selection. Mixed systems, detailed seismic detailing, irregularities/ELF-method eligibility, SSI, site-specific Chapter 21 spectra, isolation/damping and complete design certification are not inferred. Manual geotechnical classification needs a source; calculated profiles additionally require F/soft-clay screening. At overlapping Vs band endpoints the softer adjacent class is used conservatively. Global run status remains REVIEW_REQUIRED; an RS PASS is a numeric force-threshold check only.

### Independent numerical checks and workbook discrepancy

Source interpolation: `Fa = 2.5 + (.38-.25)/(.5-.25) × (1.7-2.5) = 2.084`; `Fv = 3.5 + (.14-.1)/(.2-.1) × (3.2-3.5) = 3.38`. Consequently the default SDS is **.5279466667g**, not the workbook's rounded value.

The Issue #25 historical regression explicitly supplies Fa=2.08. A documented override (source **and reason**, flagged for review) gives SMS=.7904g, SM1=.4732g, SDS=.5269333333g, SD1=.3154666667g, T0=.1197368421s and Ts=.5986842105s. Independent direct ELF checks at W=15723.584kN yield X (R=3.25,T=.211) V≈2549.3171kN and Y (R=3.5,T=.51) V≈2367.2230kN; raw RS 2266.388/2104.503kN exceeds .85V respectively. These test arithmetic, not the workbook's system eligibility: B3 at 11m exceeds the normal SDC D 35ft limit, and C4 is normally prohibited in SDC D. The integrated service preserves those gates.

Additional independently specified bounds: SDS=.6, SD1=.3, R=5, Ie=1, TL=8 gives Cs=.12 at T=.1, .06 at T=1, and .0264 minimum at T=10; with S1=.8 the conditional minimum raises Cs to .08. Already-scaled RS=90kN with existing multiplier1.5, ELF=100kN: raw60, threshold85, required total85/60, **further multiplier1**, not another85/60.

## SAP2000 import contracts

Excel is `.xlsx` values-only, including cached formula values; no formula/macros/external links executed. File parts use bounded ZIP/XML parsing, XML entity/network resolution disabled, row/column limits. Variants of sheet titles use role selection; header detection can be corrected; column mapping uses actual headers/preview. Merged-title metadata and SAP unit rows are preserved; textual source/case/settings fields inherit only explicit merged anchors with their range recorded, while numeric mass/force/multiplier cells are never replicated; recognized unit rows are excluded from numeric records. Missing numeric values or unknown units produce validation errors, never zeros. XLS/CSV, password-protected workbooks, unusual unit metadata/headers beyond supported preview limits require re-export/mapping; no broad Excel compatibility claim.

Export/map these SAP tables as applicable:

- **Mass Source Definitions**: source name, patterns and contribution multipliers; element/additional/load mass flags must come from mapped columns or explicit SAP-setting confirmations in preview. No pattern/factor retyping.
- **Mass Summary**: select **one verified net total model mass**, not the sum of group/story/joint records. Confirm correct Mass Source and constraint handling. If source name is omitted by SAP's summary, explicitly confirm association to the selected imported source. UX/UY must reconcile within .1%; otherwise directional reconciliation is required before common W. Units kg, tonne, kN-s²/m, kip-s²/ft or lbm; W=mass×9.80665/1000 kN. This mass already incorporates SAP factors and is not multiplied again.
- **Base Reactions**: case/step, global FX/FY/FZ, explicit force unit kN/N/kip/lbf/kgf/tf. For **load-only** Mass Sources, W may be derived from distinct single-pattern linear-static +Z base reactions at case factor1, with source contribution factors. Import load-case summary and linear-static loads-applied definitions to verify this relationship. Element/additional mass blocks this route; no invented balancing mass. Self weight, full reaction/constraint coverage and §12.7.2 scope require confirmations. Excluded cases and zero-factor patterns are audited.
- **Load Case Definitions / Loads Applied**: map role `cases`, case name/type and pattern/factor where available. `LinStatic`/`Linear Static` and `LinRespSpec`/`Response Spectrum` recognized; unknown types are ineligible. Summary and loads-applied sheets can enrich the same case. RS comparisons require imported response-spectrum type, exact case and row, combined SRSS/CQC result and global-axis confirmation. Individual mode/time-step rows are rejected. No arbitrary combo promoted through a checkbox.

**API** uses the existing authenticated local V2 bridge, `GET /API_IF_SAP26.2.0_V2/model`, `/tables`, `POST /table` with runtime keys, expected model identity and bounded rows. No new COM implementation or changes to Steel/RC screens. Tables from mixed models/truncated reads are rejected. Excel and API feed the same `sap-seismic/1` DTO. Original units, filename/hash/sheet/row or API model/table/row, timestamp, flags and factors survive into immutable calculation snapshots. Table units require preview confirmation because database display units differ from model units in some SAP exports.

Bridge token remains in page memory, never localStorage, calculation inputs or Laravel records. Connection status is set only after real model and table-inventory reads. Missing bridge, unsupported tables, unavailable results or browser local-network denial fail explicitly. **Actual Windows SAP2000 operation remains an external integration prerequisite, not validated by Linux fixtures.** No SAP model is changed.

RS raw/scale provenance is explicit. The existing additional force multiplier is separated from SAP spectrum g/unit scale. For already-scaled results, only a documented additional multiplier is reversed; comparison uses current absolute shear and recommends only a further multiplier if required. Zero shear has no finite scale suggestion; missing W has no V/threshold/PASS. Drift scaling §12.9.4.2 is intentionally not implemented here.

## API and data

All endpoints use existing Laravel web session/CSRF/auth and throttling:

- GET `/api/v1/seismic/coefficients`
- POST `/api/v1/seismic/imports/preview` (XLSX multipart file **or** API tables)
- POST `/api/v1/seismic/imports/{id}/confirm` (mapping)
- POST `/api/v1/seismic/calculate` (`input`, optional owned `import_id`; no user-supplied W/DTO trusted)
- GET `/api/v1/seismic/runs/{id}` (immutable snapshot)

Additive tables `seismic_imports` and `seismic_runs` are scoped to the authenticated user, including admins. Confirmed imports are immutable; reupload/read to remap. Runs embed source DTO and input/output snapshot with coefficient version, so later imports do not change previous results. Failed validation writes no run. Full reporting/export and project workspace restoration are future work.

## Verification

See the delivery entry in [HANDOFF](HANDOFF.md) for executed commands/counts and screenshots. Test fixture is synthetic, not the unavailable NEWSTAR workbook or a live customer model. The generator produces an actual XLSX with four sheets, merged titles, shifted headers and units rows; API and Excel normalization are independently compared. Tests cover auth/ownership, missing W, source coefficients versus historical rounding, 30m profiles, periods/units/system gates, mass reconciliation/factors/signs, ELF branches, RS thresholds/scaling and invalid archives.

To run the native browser smoke, start a **disposable** Laravel database/server (`artisan serve --no-reload` is essential when overriding DB variables; reload mode strips those variables). Generate XLSX using `Tests\Fixtures\Seismic\SapFixture::xlsx('/tmp/seismic-sample.xlsx')`. Provide a private `AUTH_FIXTURES` file to the existing login helper, then:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright AUTH_FIXTURES=/private/test-accounts.json \
SEISMIC_XLSX=/tmp/seismic-sample.xlsx SEISMIC_BASE_URL=http://127.0.0.1:5178/ \
node structural-platform/tests/seismic-load-smoke.cjs
```

Do not use real user accounts/models as test fixtures. Unit/Feature tests use SQLite `:memory:` explicitly. User migrations/deployment are separate from this Draft PR.
