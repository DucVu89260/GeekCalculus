@echo off
setlocal
set "API_ROOT=C:\geek_calculus\SAP2000-API"
if /I not "%~dp0"=="%API_ROOT%\" (
    echo Extract the complete API kit to C:\geek_calculus\SAP2000-API and run this file there.
    pause
    exit /b 1
)
cd /d "%API_ROOT%"
rem Default to automatic discovery; explicit --pid remains available for diagnostics.
set "SAP2000_PID="
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
