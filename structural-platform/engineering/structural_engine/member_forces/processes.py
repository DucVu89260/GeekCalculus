"""Read SAP2000 process IDs using Windows' built-in tasklist, without new dependencies."""
from __future__ import annotations
import csv
import io
import os
from pathlib import Path
import subprocess
from .sap2000 import SapError


def parse_tasklist(output: str) -> list[int]:
    pids = set()
    for row in csv.reader(io.StringIO(output)):
        if not row or row[0].strip().casefold() != 'sap2000.exe':
            continue  # Includes localized tasklist's 'no tasks found' message.
        try:
            pid = int(row[1])
            if not 0 < pid <= 2147483647:
                raise ValueError()
        except (ValueError, IndexError) as error:
            raise SapError('SAP2000_PID_DISCOVERY: Invalid PID from tasklist; cannot select an instance safely.') from error
        pids.add(pid)
    return sorted(pids)


def running_sap2000_pids() -> list[int]:
    if os.name != 'nt':
        raise SapError('SAP2000_PID_DISCOVERY: Automatic discovery requires Windows.')
    executable = Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32' / 'tasklist.exe'
    try:
        result = subprocess.run([str(executable), '/FI', 'IMAGENAME eq SAP2000.exe', '/FO', 'CSV', '/NH'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10, check=False,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SapError('SAP2000_PID_DISCOVERY: Cannot query Windows processes. Check that tasklist.exe is available and retry.') from error
    if result.returncode != 0:
        raise SapError('SAP2000_PID_DISCOVERY: Windows process query failed; no PID was selected.')
    # Only image name/PID (ASCII fields) are consumed. Localized session/memory columns are ignored.
    return parse_tasklist(result.stdout.decode('utf-8', errors='replace'))


def discover_sap2000_pid() -> int:
    pids = running_sap2000_pids()
    if not pids:
        raise SapError('SAP2000_NOT_RUNNING: Chưa mở SAP2000. Hãy mở SAP2000 26.2.0 và model, rồi bấm Kết nối / Làm mới model.')
    if len(pids) != 1:
        raise SapError('SAP2000_MULTIPLE_INSTANCES: Có nhiều phiên SAP2000 đang chạy (PID: '
                       + ', '.join(map(str, pids)) + '). Chỉ giữ một phiên SAP2000 rồi kết nối lại.')
    return pids[0]
