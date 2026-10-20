# Seismic Load — ASCE 7-10 implementation specification (Phase A)

Status: planning/design baseline. No production calculation code is claimed implemented by this document.

## Source workbook
NEWSTAR1_NX5_SEISMIC(1).xlsx: G, BASE_REACT, DRIFT, SITE_CLASS.

## Module navigation
Loading > Seismic Load > [Project & Site | Design Spectrum | Seismic Systems | Base Shear | Story Drift | SAP2000 & Report].

## A. Project & Site
Inputs: standard=ASCE 7-10, units, project, risk category, importance factor Ie (derived or manual override), building elevation/height, region, Ss, S1, site class or geotechnical boreholes, seismic design category. Store provenance and manual override reasons.
Site classification: borehole intervals to depth 30 m; compute weighted Nbar = sum(h_i)/sum(h_i/N_i), respecting the code definitions, corrected N-values, eligible strata and missing intervals; do not use '20/sum' for a 30m profile. Flag insufficient depth/data, site class F criteria, and need for site-specific study.
Where seismic maps are absent, Ss and S1 are manually entered with explicit authoritative source, not automatically guessed from coordinates.

## B. Response spectrum
Lookup structured, versioned ASCE 7-10 Table 11.4-1 Fa, Table 11.4-2 Fv (interpolation plus special cells and exceptions) and compute SMS=Fa*Ss, SM1=Fv*S1, SDS=2/3*SMS, SD1=2/3*SM1, T0=.2*SD1/SDS, Ts=SD1/SDS; include long-period TL input/lookup and appropriate branches. Mark all conditional and site-specific requirements explicitly rather than silently applying generic values.
Provide spectral curve and the equations/provenance for every computed cell.

## C. Seismic force resisting systems
Input per horizontal axis: SFRS system, R, Cd, Omega0 via versioned Table 12.2-1 (no hardcoding to an axis, disallow invalid systems by risk/category/height where applicable), Ct,x via Table 12.8-2, Cu via Table 12.8-1; modal T and optionally mode metadata.
Ta=Ct*(hn_ft)^x (or use consistent metric coefficient), T_cap=Cu*Ta; Tused=min(Tmodal,T_cap) for force rules subject to exact standard conditions. Do not mix raw Tmodal and Tused.

## D. Base shear and RS verification
Cs = SDS/(R/Ie), adjust for upper bounds/long-period rules, lower bound max(0.044*SDS*Ie,0.01), and conditional S1>=0.6g minimum 0.5*S1/(R/Ie) per ASCE 7-10 §12.8.1.1; require careful implementation and reference QA.
W from documented seismic mass source, not from unqualified full gravity loads: load patterns and contribution factors; support distinct default, collateral, live-load conditions as applicable to §12.7.2. Distinguish gravitational reactions used to establish W from already-combined results.
Import or manually enter signed SAP2000 global FX/FY and unit metadata; use absolute shear along matched axis, choose selected case and step/envelope correctly. Keep raw V_RS vs scaled V_RS separate.
For ASCE 7-10 modal response spectrum approach evaluate governing §12.9.4.1 scale benchmark and any project-specific exceptions explicitly; default 0.85 * ELF threshold where applicable. Required multiplier = max(1, threshold / abs(V_RS_raw)) when scaling required. Report actual ratio, PASS/FAIL, scaling suggestion. Avoid double scaling.

## E. Story drift
For story i: elastic relative displacement delta_e,i = |u_e,i - u_e,i-1| with signed case/directional consistency; amplified delta_i=Cd*delta_e,i/Ie as applicable; allowable=table factor*h_sx,i. Separate roof displacement from story drift. Include story-by-story table X/Y with diaphragm corner / torsion assessment and stability P-delta requirements / warnings. No unconditional fixed 0.02 coefficient; versioned Table 12.12-1 and conditions.

## F. API and separation of concerns (Laravel)
Dedicated deterministic calculation services, no HTTP/database dependencies:
- SiteClassificationService
- SpectrumService
- SeismicSystemService
- BaseShearService
- StoryDriftService
- Sap2000SeismicImportService
- SeismicReportService
Separate schema versions, immutable input/output snapshots, coefficient version provenance, units, error codes and test fixtures.
Prefer keeping UI in established frontend architecture and integrating only through existing backend patterns after codebase inspection.

Suggested objects: seismic_projects, seismic_scenarios, seismic_directions, seismic_mass_components, seismic_story_displacements, seismic_calculation_runs, seismic_standard_tables (versioned), sap_import_jobs.
Endpoints (subject to existing routing conventions): GET /api/seismic/standards, /api/seismic/coefficients; POST /api/seismic/calculate; POST /api/seismic/sap2000/import; GET /api/seismic/runs/{id}/report.
Input data constraints and units must be explicit; errors should be descriptive and not coerced to zero.

## G. Regression fixture from workbook (not certification)
Given h=11m, Ss=.38g, S1=.14g, Site=E, Fa=2.08, Fv=3.38:
SMS=.7904, SM1=.4732, SDS=.52693333, SD1=.31546667, T0=.11973684s, Ts=.59868421s.
Workbook X: R=3.25, Ie=1, Tmodal=.211s, Cs=.16213333; W=15723.584kN; V_ELF=2549.3171kN; |V_RS|=2266.388kN; threshold=2166.920kN => PASS on workbook's 85% criterion.
Workbook Y: R=3.5, Ie=1, Tmodal=.51s, Cs=.15055238; V_ELF=2367.2230kN; |V_RS|=2104.503kN; threshold=2012.140kN => PASS on same criterion.
Drift workbook X: Cd=3.25, delta_elastic_roof=1.75cm, amp=5.6875cm, 0.02*11m=22cm.
Drift workbook Y: Cd=3.5, delta_elastic_roof=1.41cm, amp=4.935cm, limit=22cm.
These are *historical input checks only*: coefficient/system appropriateness, governing code requirements, mass-source scope, drift assumptions must be verified.

## H. Definition of done / tests
Unit tests covering interpolation table boundaries and exceptions, Nbar weighting with 30m, invalid site classification data, Cs minimum and maximum/long period, different X/Y SFRS, raw vs scaled RS, correct seismic mass factors, units and sign conventions, story drift of two+ stories, allowable drift from risk category, stability alerts, regression with the fixture.
Include formula/standard/table references in every output; document manual override and date/version. No production PASS unless all required input validation has succeeded.

## Delivery phases
Phase A: inspect current Loading page + backend; implement versioned coefficient store, pure services for spectrum and ELF, unit tests and UI inputs.
Phase B: mass-source, RS import and base shear/scale.
Phase C: story-by-story drift and P-delta hooks.
Phase D: reports, persisted calculation runs, and SAP2000 API bridge.


## Updated implementation scope — 2026-10-20
**Active implementation sections: 01–06.** 07–09 are navigation placeholders only.

04: SAP2000 Mass Source extraction through Excel export or existing API. It must extract and report load patterns/contribution factors and verify the actual effective seismic weight W, distinguishing a definition from numeric model mass/weight. Do not fabricate W when source incomplete; normalize and validate units and spreadsheet provenance. Both import modes share DTO.

05: ELF Base Shear, sourced from 04 (not manual arbitrary W). Apply 12.8 Cs branches and compare X/Y. Preserve unit audit.

06: Response Spectrum and verification against ELF using SAP2000 Excel-exported RS base reactions or SAP API results. Normalize signed global FX/FY, case and scale provenance; avoid double scaling. Compute suggested scaling only where applicable per ASCE 7-10.

07: Story Drift and P-Delta — Coming Soon (navigation placeholder).
08: Reports and Export — Coming Soon (navigation placeholder).
09: QA and Design Review UI — Coming Soon (navigation placeholder; automated tests for 01–06 still mandatory).

**Implementation task**: https://github.com/DucVu89260/GeekCalculus/issues/25. The issue's acceptance criteria govern this scope update. This document is a specification, not a claim of implementation.
