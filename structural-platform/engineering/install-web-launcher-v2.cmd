@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-web-launcher-v2.ps1"
if errorlevel 1 echo Installation failed. Read the PowerShell message above.
pause
