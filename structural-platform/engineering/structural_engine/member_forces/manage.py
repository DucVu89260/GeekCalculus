"""Stop only a positively identified connector on port 8010; never SAP2000."""
import os
import subprocess

STOP_SCRIPT = r'''
$ErrorActionPreference = 'Stop'
$owners = @(Get-NetTCPConnection -LocalPort 8010 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if ($owners.Count -eq 0) { Write-Output 'Port 8010 is free.'; exit 0 }
foreach ($ownerId in $owners) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId"
    if ($null -eq $p) { continue }
    if (($p.Name -notmatch '^python(w)?\.exe$') -or
        ($p.CommandLine -notmatch '(?i)(?:^|\s)-m\s+"?structural_engine\.member_forces\.run_connector"?(?:\s|$)')) {
        Write-Output "Refusing to stop unknown port owner PID $ownerId. Close its application manually."
        exit 1
    }
    $result = Invoke-CimMethod -InputObject $p -MethodName Terminate
    if ($result.ReturnValue -ne 0) { throw "Cannot stop connector PID $ownerId." }
    Write-Output "Stopped API connector PID $ownerId. SAP2000 was not stopped."
}
'''


def main():
    if os.name != 'nt':
        raise SystemExit('This command requires Windows.')
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive',
                             '-Command', STOP_SCRIPT], check=False)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
