@echo off
setlocal
set "API_ROOT=C:\geek_calculus\SAP2000-API"
if /I not "%~dp0"=="%API_ROOT%\" (
    echo Extract the complete V2 kit to C:\geek_calculus\SAP2000-API.
    pause
    exit /b 1
)
cd /d "%API_ROOT%"
echo Checking machine-local Python environment...
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -I bootstrap-sap2000-env.py --check >nul 2>nul
    if not errorlevel 1 goto environment_ready
)
echo Preparing a fresh environment for this Windows machine. Existing files will be preserved.
if exist ".runtime\python.exe" (
    ".runtime\python.exe" -I -c "import sys,struct,venv,ensurepip; sys.exit(0 if sys.version_info[:2] in ((3,13),(3,12),(3,11)) and struct.calcsize('P') == 8 else 1)" >nul 2>nul
    if not errorlevel 1 (
        ".runtime\python.exe" -I bootstrap-sap2000-env.py
        if errorlevel 1 goto failed
        goto environment_ready
    )
)
for %%V in (3.13 3.12 3.11) do (
    py -%%V -I -c "import sys,struct,venv,ensurepip; sys.exit(0 if sys.version_info[:2] in ((3,13),(3,12),(3,11)) and struct.calcsize('P') == 8 else 1)" >nul 2>nul
    if not errorlevel 1 (
        py -%%V -I bootstrap-sap2000-env.py
        if errorlevel 1 goto failed
        goto environment_ready
    )
)
echo No supported Python found. Install Python 3.13 64-bit with Python Launcher [py].
echo Supported choices: Python 3.13, 3.12 or 3.11, 64-bit. The launcher does not select Python 3.15.
echo A full compatible runtime may alternatively be supplied at .runtime\python.exe.
goto failed
:environment_ready
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
echo V2 could not start. Read the specific Python, dependency or port error above.
echo Keep SAP2000 open. Match its Windows account and Administrator level.
pause
exit /b 1
