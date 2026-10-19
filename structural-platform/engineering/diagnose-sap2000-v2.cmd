@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Run start-sap2000-v2.cmd first to create the V2 Python environment.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -I bootstrap-sap2000-env.py --check
if errorlevel 1 (
    echo This environment belongs to another machine or is broken. Run start-sap2000-v2.cmd to repair it automatically.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m structural_engine.sap2000_v2.diagnose %*
pause
