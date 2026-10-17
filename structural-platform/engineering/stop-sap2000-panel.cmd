@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo No Python environment found. Close the old connector window with Ctrl+C.
    pause
    exit /b 1
)
echo Close active exports before continuing. SAP2000 will remain open.
pause
".venv\Scripts\python.exe" -m structural_engine.member_forces.manage
set "STOP_RESULT=%ERRORLEVEL%"
pause
exit /b %STOP_RESULT%
