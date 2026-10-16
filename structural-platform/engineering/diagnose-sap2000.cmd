@echo off
setlocal
set "API_ROOT=C:\SAP2000-Forces"
if /I not "%~dp0"=="%API_ROOT%\" (
    echo Extract the complete API kit to C:\SAP2000-Forces and run this file there.
    pause
    exit /b 1
)
cd /d "%API_ROOT%"
rem Default to automatic discovery; explicit --pid remains available for diagnostics.
set "SAP2000_PID="
if not exist ".venv\Scripts\python.exe" (
    echo Run start-sap2000-panel.cmd first to install the Python environment.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m structural_engine.member_forces.diagnose %*
pause
