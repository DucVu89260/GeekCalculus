@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Run start-sap2000-panel.cmd first to install the Python environment.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m structural_engine.member_forces.diagnose %*
pause
