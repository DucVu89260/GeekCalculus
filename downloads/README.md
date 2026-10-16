# API_IF_SAP26.2.0_V1 — Windows kit

Download [API_IF_SAP26.2.0_V1.zip](API_IF_SAP26.2.0_V1.zip?raw=true), then extract the entire archive on the Windows machine running SAP2000 26.2.0.

1. Install 64-bit Python 3.12 with the Python Launcher (`py`).
2. Open/save the SAP2000 model and run analysis.
3. Double-click `start-sap2000-panel.cmd` in the extracted folder. Dependencies are installed from the pinned requirements; Internet access is needed for installation.
4. Keep the console open. The browser opens the local panel automatically.
5. Confirm the active model filename, choose Output Cases, select frame objects in SAP2000, then return to the panel and extract forces.

The kit contains source, a local web panel and a Windows launcher. It is not an installer or an executable. No tokens, exported model data, virtual environment or dependencies are bundled. Cb is a separate internal AISC 360-10 module, not an endpoint of the force API.

Cloud validation: 297 Python tests passed; browser smoke checks passed using a simulated SAP2000 interface. Real COM integration still requires acceptance testing on Windows with SAP2000 26.2.0. See `SAP2000-API.md` and `BAT-DAU.txt` inside the ZIP.

SHA256: `6e245e1e4ce8f6b8fbef572e1a00ea215fe90b48c83c7555f2148601f7c04e9b`
