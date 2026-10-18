# SAP2000-API V2 — Local preview

Build: `2026.10.18-v2-local.2` · Compatible with SAP2000 v26.2.0 · Windows 64-bit.

## Chạy thử / Quick start

1. Giải nén **toàn bộ nội dung** ZIP vào `C:\geek_calculus\SAP2000-API\V2` (file `start-sap2000-v2.cmd` phải nằm ngay trong thư mục V2). Không ghi đè bộ V1 ở thư mục cha.
2. Cài Python 64-bit 3.11 trở lên, có Python Launcher `py`. Lần đầu cần Internet để cài dependencies; `.venv` của V2 được tạo riêng.
3. Mở SAP2000 **26.2.0**, mở model đã lưu. Chạy phân tích trước nếu cần nội lực/chuyển vị; chạy Steel Design trong SAP trước nếu cần kết quả thiết kế SAP.
4. Dừng connector V1 đang chạy bằng **Ctrl+C** trong cửa sổ của nó, đợi tác vụ xuất hoàn tất trước khi dừng. Giữ SAP2000 mở. V1/V2 cùng dùng cổng **8010**, không chạy đồng thời.
5. Chạy `start-sap2000-v2.cmd` bằng cùng tài khoản Windows và mức quyền với SAP2000. Nếu SAP đang chạy Administrator, chạy CMD này Administrator.
6. Trình duyệt mở panel local với token tự sinh. Giữ cửa sổ connector chạy; không cần nhập token hay đăng ký web launcher.
7. Bấm **Quét SAP2000 đang mở**, chọn đúng tên file/PID, rồi **Kết nối / Làm mới model**.
8. Chọn frame objects trong SAP. Ở **V2 · Dữ liệu cấu kiện thép**, chọn nhóm dữ liệu rồi đọc snapshot. Bắt đầu với 5 nhóm mặc định, sau đó mở rộng từng nhóm. Chọn Case/Combo trước khi đọc nội lực hoặc chuyển vị.
9. Chọn cấu kiện / danh mục / nhóm để xem cây dữ liệu và bảng; tải JSON để giữ toàn bộ dữ liệu gốc. Các mục nội lực, lọc vị trí, cực trị và Summary giữ bố cục V1.

**English:** Extract all kit files to `C:\geek_calculus\SAP2000-API\V2`. Install Python 3.11+ 64-bit with `py`. Keep a saved SAP2000 26.2.0 model open, stop the V1 connector, then run `start-sap2000-v2.cmd` at the same Windows user/elevation as SAP. Scan/select the model, connect, select SAP frames, choose data groups and read a snapshot. Select output cases for force/displacement reads. Keep the connector window running.

## Dữ liệu / Coverage

- Identity: frame name, GUID, groups, assigned/analyzed section, auto-select and material overwrite.
- Sections: installed-DLL shape type, common-shape dimensions, source properties A/As/J/I/S/Z/r and separate modifiers. Nonprismatic segments retain start/end sections, relative/absolute length and EI variation; component sections are read recursively.
- Materials: source material type, E/G/Poisson/thermal expansion/densities, steel Fy/Fu and expected strengths where supported; member material overwrite stays distinct from library values.
- Geometry: I/J points and coordinates, length, local-axis assignment, advanced axes/transformation where available.
- Assignments: releases/partial fixity, insertion/end offsets/rigid zone, spring/hinge assignments and temperature assignments, subject to actual installed API signatures.
- Loads: frame distributed/point/temperature/gravity loads, selected case/combo definitions and factors; missing API data remains explicit.
- Forces: inherited V1 extraction/position interpolation/extremes/section summary; no strength or Cb calculation added.
- Displacements/reactions: selected output joint endpoint results and frame-joint force output. Joint response axes are **point-element local**, not automatically frame-local/global. This is not a full-span deflection check.
- Steel design: active code, available results, selected design combinations, design section, summary D/C and messages where supported. Indexed preferences (35) and overwrites (43) are currently mapped **only for AISC 360-10**. Other codes return unsupported mapping, never guessed indices. ProgDet/source override values are retained, not applied to library properties.
- DatabaseTables: inventory and fields from the actual DLL; read a selected available table with bounded records (default5000/max50000, preview200). Table display selection follows SAP's existing database-table display state; it is independent of the panel's output-case picker. Raw table strings are not silently unit-converted.

Some getters, shapes or design methods can be unsupported on the installed DLL. `unsupported`, `unavailable`, `empty`, `input_required` and failed-read statuses are shown with source/signature context. Missing data is **not substituted with zero**. General/Section Designer geometry is not a complete design-ready decomposition. Material library properties at temperature0 are not a temperature-adjusted member analysis model.

## Units and source fidelity

SAP numeric reads use kN–m–C, force axes/signs unchanged; original units and temporarily changed output selections are restored. Avoid editing/switching the SAP model during reads. Section/material normalized convenience fields use explicit mm/MPa scaling; source values remain separate. No modifiers are silently applied. Force displays use two decimals, while JSON/interpolation/extreme computations preserve raw precision. Existing force datasets retain their V1 DTO; V2 snapshots use schema2 and API prefix `/API_IF_SAP26.2.0_V2`.

## Diagnostics

If scanning fails, confirm matching Windows user/elevation and that SAP has no modal dialog open. Optional explicit settings:

```cmd
start-sap2000-v2.cmd --pid 20948 --dll "C:\Program Files\Computers and Structures\SAP2000 26\SAP2000v1.dll"
diagnose-sap2000-v2.cmd --pid 20948 --dll "C:\Program Files\Computers and Structures\SAP2000 26\SAP2000v1.dll"
```

Replace the example PID with the current PID. The panel also exports a runtime capabilities report. Share failed status/source/signature and diagnostics, **never the connector token**. Snapshots include model paths and engineering data; review before sharing.

## Preview limits and validation

This is a **local development preview**, not a hosted V2 release. No website navigation, protocol registration or V1 files are changed. Allowlisted getters only: no automatic analysis/design runs or assignments. SAP units/output selections may be temporarily changed for reads and restored afterward.

Verified in cloud: synthetic-SAP API/unit/restore/error tests, real CLR reflection fixtures (without SAP DLL), and Chromium panel workflow with synthetic SAP. **Actual Windows + SAP2000 26.2.0 verification is not performed here.** Validate first on a copy of a small model; compare section, material, geometry, overwrites and force results with SAP before production use.

Reference metadata: Ephraim-Bryski/SAP-Tooltips commit `608415951abf7c601c3939ed0296cd1daa45eda5`. This reference contains mixed/older signatures; actual installed interface metadata controls calls. The kit does not redistribute SAP DLLs, CHM or third-party documentation binaries.
