@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    py -3 -m venv .venv
    if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -m pip install -r requirements-test.lock -r requirements-windows.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m structural_engine.member_forces.run_connector %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Cannot start SAP2000 panel. Check Python 64-bit 3.11+ and the error above.
pause
exit /b 1
