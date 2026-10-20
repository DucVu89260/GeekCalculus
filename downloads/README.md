# SAP2000-API V2 — current web/local kit

Download [API_IF_SAP26.2.0_V2.zip](API_IF_SAP26.2.0_V2.zip?raw=true). Build **2026.10.20-v2-cb-audit.1**, SAP2000 **26.2.0**.

Portable update: startup automatically backs up and recreates a broken machine-specific `.venv`. Install Python 3.13 x64 with `py` on each PC (3.12/3.11 also supported); Python 3.15 is not selected. Runtime is not bundled; initial dependency installation needs Internet. Extract at `C:\geek_calculus\SAP2000-API` and run `start-sap2000-v2.cmd` or the existing web launcher.

1. Finish active reads and stop the old connector with Ctrl+C; keep SAP2000 open.
2. Extract all files directly to **`C:\geek_calculus\SAP2000-API`**, keeping an existing compatible `.venv`. No V2 subfolder.
3. Run **`install-web-launcher.cmd`** once to install/upgrade the protocol registration to V2 (also required for users of the old V1 launcher).
4. Click SAP2000-API on GeekCalculus and accept browser/UAC prompts; keep connector running. Local-only use: `start-sap2000-v2.cmd`.

The existing web address remains [SAP2000-API](https://ducvu89260.github.io/GeekCalculus/sap2000-api/26.2.0/?lang=vi). Read `SAP2000-API-V2.md` in the kit. [V2 checksum](API_IF_SAP26.2.0_V2.zip.sha256). No tokens, environments, SAP DLLs or model exports are bundled.

Validated with targeted API/auth/private-network tests and local/hosted browser flows using synthetic SAP. Windows protocol/UAC and actual SAP acceptance must be checked on the target device; user has already confirmed basic section/material extraction in prior local previews.

---

## Archived V1 distribution notes

# API_IF_SAP26.2.0_V1 — Windows kit

Download [API_IF_SAP26.2.0_V1.zip](API_IF_SAP26.2.0_V1.zip?raw=true), then extract the entire archive on the Windows machine running SAP2000 26.2.0.

1. Install 64-bit Python 3.12 with the Python Launcher (`py`).
2. Open/save the SAP2000 model and run analysis.
3. Double-click `start-sap2000-panel.cmd` in the extracted folder. Dependencies are installed from the pinned requirements; Internet access is needed for installation.
4. Keep the console open. The browser opens the local panel automatically.
5. Confirm the active model filename, choose Output Cases, select frame objects in SAP2000, then return to the panel and extract forces.

The kit contains source, a local web panel and a Windows launcher. It is not an installer or an executable. No tokens, exported model data, virtual environment or dependencies are bundled. Cb is a separate internal AISC 360-10 module, not an endpoint of the force API.

Cloud validation: 375 Python tests passed (including three real CLR fixture tests); browser smoke checks passed using a simulated SAP2000 interface. Real COM integration still requires acceptance testing on Windows with SAP2000 26.2.0. See `SAP2000-API.md` and `BAT-DAU.txt` inside the ZIP.

SHA256: `13209a701d5febe2fcc2eae68a50eced568a727ca08f7c3a1ec78dc77e73f4ee`

If the panel opens but model connection returns HTTP 503, run `diagnose-sap2000.cmd` from the same folder. It reports the failing COM stage and HRESULT without exposing tokens.

Current build: **2026.10.17-web-panel.14**. Uses direct `SAP2000v1.dll` loading with pythonnet 3.2.1. Extract the complete kit to `C:\SAP2000-Forces`, open the SAP2000 models you want to use and double-click `start-sap2000-panel.cmd`. Click Scan SAP2000, select the model filename/PID from the dropdown and connect; no manual PID entry is needed. Does not require COM Helper registration or SAP2000 Repair. Tokens survive reload within the browser tab. Real model extraction still requires comparison against SAP2000 output tables.

Build .2 fixes response combination extraction using `RespCombo.GetTypeOAPI`; covers mixed cases/combinations and nested combinations. Envelope/statistical results remain nonconcurrent and cannot be exported as connection action vectors.

Model discovery uses Windows tasklist plus direct DLL/PID reads to show all running SAP2000 models. Multiple instances are supported through explicit filename/PID selection. Inaccessible or unsaved models are listed with errors instead of silently omitted. Discovery is verified with simulated Windows processes and model interfaces; native multi-instance discovery still requires a Windows check.

Station update: full mode uses original stations plus available five-point samples. Quick mode expands Summary governing Frame/Combo pairs to the same station set. Nonprismatic linear-depth I/H has explicitly labelled prismatic-reference D/C only; tapered-member stability remains REVIEW_REQUIRED. See kit guide for restrictions.
