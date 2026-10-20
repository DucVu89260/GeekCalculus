# Multi-segment local reference mapping — 2026-10-20

This is data/geometry mapping for the existing user-declared local prismatic reference, not a new AISC tapered-member resistance rule. Existing AISC360-10 source audit and all tapered REVIEW_REQUIRED/unknown-concurrency guards remain. No phi/Omega, nominal resistance or Cb equation changes.

## Source evidence

Read the public SAP-Tooltips documentation mirror at commit `608415951abf7c601c3939ed0296cd1daa45eda5`, as requested in the project history. `CSI_OAPI_Documentation/SAP2000_API_Fuctions/Definitions/Properties/Frame/GetNonPrismatic.htm`, SHA256 `8b8ab5898991c95de9f470662b5d074acaf7f31ad6163d9a8667cdb99443800b`, defines NumberItems and parallel StartSec/EndSec/MyLength/MyType arrays; MyType1 variable relative,2 absolute length. EI33/EI22 variation codes are stiffness metadata, not a height interpolation definition. This mirror is not independently verified as the exact26.2 design manual; installed DLL reflection remains signature authority. No documentation bundle or user model is published.

The same mirror's `Results.Setup.GetOptionNLStatic`, `GetOptionMultiStepStatic`, `GetOptionMultiValuedCombo` define read-only Value outputs; for static options1 envelope,2 step-by-step,3 last step; multivalued combo1 envelope,2 multiple values if possible,3 correspondence. `RespCombo.GetTypeOAPI` codes0 linear additive,1 envelope,2 absolute additive,3 SRSS,4 range additive. Three getter reads added to diagnostics only; no setters, result relabelling or inference that a linear-additive parent has concurrent children.

## Mapping contract

Full property only (assignment total length0, relative start0, statusok); confirmed I-J length. Validate positive finite segment lengths and MyType. Absolute lengths consume physical meters; remaining length is apportioned by relative weights. If every segment is absolute, accept only total length within0.1mm of Frame length, disclose proportional normalization to I-J length; reject larger mismatch instead of guessing offsets. This rounding reconciliation is an explicit local-reference convention, not a generally verified CSI scaling algorithm.

Use each selected segment's endpoint geometries and local station fraction; h interpolates linearly by the user's accepted assumption, remaining flange/web dimensions fixed within that segment. Endpoints may be numerically clamped within1e-6m; internal boundary candidate tolerance1e-9m. At shared boundaries require continuous actual dimensions; otherwise block because side is unresolved. Effective material/overwrite must be confirmed at both endpoints. Keep original station, selected segment bounds/index, entire layout and scale provenance. Local reference always REVIEW_REQUIRED for tapered stability, and cannot be passed to the prismatic member receiver as a fully verified member.

## Independent fixture

Anonymized source case: absolute segments3.4249m (constant h400) and0.8m (h400→620); Frame length4.224878696483485m. Difference21.303516515micrometers. Separate Decimal arithmetic gives scale0.99999495762822433667, boundary3.42488273038090553066m, second midpoint3.82488071343219526533m, h510mm at that midpoint, h558.158046636921435mm at x4m and h620mm at end. Exported native element boundary3.424882730389057m agrees within1e-10m; do not claim exact identity or infer element correspondence generally. Tests also cover relative/mixed spans, larger mismatch, discontinuity, materials/assignment barriers and tiny endpoint floating overrun.

## Demand evidence

User supplied Section Summary JSON, not a prepared-input snapshot. It confirms section parts/type2 and already classified nonconcurrent Max/Min result rows, but has no combo definition tree/output options or raw assignment. Do not infer why from its name/MaxMin alone, copy it into a synthetic concurrent fixture or calculate H1 from an unverified force vector. New diagnostic snapshot obtains exactly those missing source fields via the existing authenticated read-only endpoint. Valid mapped geometry is retained even when demand validity blocks capacities; missing result stays null, never0.

Validation counts, package/build and unverified Windows details are recorded in context/HANDOFF.md (SAP-NP-11). Actual user's D/C remains blocked until concurrency/source data is resolved; this geometry fix is not a claim that all14records now produce capacity results.
