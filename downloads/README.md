# API_IF_SAP26.2.0_V1 — Windows kit

Download [API_IF_SAP26.2.0_V1.zip](API_IF_SAP26.2.0_V1.zip?raw=true), then extract the entire archive on the Windows machine running SAP2000 26.2.0.

1. Install 64-bit Python 3.12 with the Python Launcher (`py`).
2. Open/save the SAP2000 model and run analysis.
3. Double-click `start-sap2000-panel.cmd` in the extracted folder. Dependencies are installed from the pinned requirements; Internet access is needed for installation.
4. Keep the console open. The browser opens the local panel automatically.
5. Confirm the active model filename, choose Output Cases, select frame objects in SAP2000, then return to the panel and extract forces.

The kit contains source, a local web panel and a Windows launcher. It is not an installer or an executable. No tokens, exported model data, virtual environment or dependencies are bundled. Cb is a separate internal AISC 360-10 module, not an endpoint of the force API.

Cloud validation: 316 Python tests passed (including three real CLR fixture tests); browser smoke checks passed using a simulated SAP2000 interface. Real COM integration still requires acceptance testing on Windows with SAP2000 26.2.0. See `SAP2000-API.md` and `BAT-DAU.txt` inside the ZIP.

SHA256: `6437280768f2ebcd880faaa96a64be929924c3208d330ff72f1b6c062e68d851`

If the panel opens but model connection returns HTTP 503, run `diagnose-sap2000.cmd` from the same folder. It reports the failing COM stage and HRESULT without exposing tokens.

Current build: **2026.10.16-dotnet-pid.3**. Uses direct `SAP2000v1.dll` loading with pythonnet 3.2.1. Extract the complete kit to `C:\SAP2000-Forces`, open exactly one SAP2000 instance and double-click `start-sap2000-panel.cmd`. PID discovery is automatic; no PID entry is needed. Does not require COM Helper registration or SAP2000 Repair. Tokens survive reload within the browser tab. Real model extraction still requires comparison against SAP2000 output tables.

Build .2 fixes response combination extraction using `RespCombo.GetTypeOAPI`; covers mixed cases/combinations and nested combinations. Envelope/statistical results remain nonconcurrent and cannot be exported as connection action vectors.

Auto PID uses the Windows built-in tasklist command on each automatic attachment. Zero or multiple SAP2000 processes produce an actionable error; no arbitrary process is chosen. Manual PID remains under advanced settings. Process discovery is verified with simulated Windows subprocess responses; native discovery still requires a Windows check.
