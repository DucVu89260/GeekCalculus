@echo off
setlocal
set "API_ROOT=C:\geek_calculus\SAP2000-API"
if /I not "%~dp0"=="%API_ROOT%\" (
    echo Extract the complete V2 kit to C:\geek_calculus\SAP2000-API.
    pause
    exit /b 1
)
cd /d "%API_ROOT%"
if not exist ".venv\Scripts\python.exe" (
    py -3 -m venv .venv
    if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -c "import sys,struct; sys.exit(0 if sys.version_info >= (3,11) and struct.calcsize('P') == 8 else 1)"
if errorlevel 1 (
    echo V2 requires Python 3.11 or newer, 64-bit. Recreate this V2 .venv with Python 64-bit.
    goto failed
)
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements-test.lock -r requirements-windows.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -c "import uvicorn,fastapi,pydantic,clr"
if errorlevel 1 (
    echo V2 dependencies are incomplete. Read the installation error above and retry this launcher.
    goto failed
)
".venv\Scripts\python.exe" -m structural_engine.sap2000_v2.run_connector %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo V2 could not start. Read the message above. Stop the V1 connector with Ctrl+C before starting V2.
echo Keep SAP2000 open. Match its Windows account and Administrator level.
pause
exit /b 1
