$ErrorActionPreference = 'Stop'
$root = 'C:\geek_calculus\SAP2000-API'
if ($PSScriptRoot -ine $root) { throw "Extract the kit to $root before installing." }
if (-not (Test-Path "$root\start-sap2000-panel.cmd")) { throw 'The API kit is incomplete.' }
# Per-user registration. No scheduled tasks, stored admin credentials or UAC bypass.
$key = 'HKCU:\Software\Classes\geekcalculus-sap2000'
New-Item -Force $key | Out-Null
Set-Item $key -Value 'URL:GeekCalculus SAP2000 26.2.0 launcher'
New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-Item -Force "$key\shell\open\command" | Out-Null
Set-Item "$key\shell\open\command" -Value ('"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "' + $root + '\open-sap2000-web.ps1" "%1"')
Write-Host 'Installed. Click SAP2000-API on GeekCalculus and accept the browser / Windows prompts.'
