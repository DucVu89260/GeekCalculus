"""Read model identity for each running SAP2000 PID; never open or modify models."""
from .dotnet import ConnectionSettings, connect_dotnet
from .processes import running_sap2000_pids
from .sap2000 import SapError


def scan_instances(settings, *, pid_provider=None, opener=None):
    pids = (pid_provider or running_sap2000_pids)()
    connect = opener or connect_dotnet
    result = []
    for pid in pids:
        entry = {'pid': pid, 'filename': None, 'model': None, 'locked': None,
                 'available': False, 'error': None}
        try:
            with connect(ConnectionSettings(pid=pid, dll_path=settings.dll_path)) as sap:
                sap.verify_version()
                info = sap.model_info()
                entry.update(info)
                entry['pid'] = pid
                if not info['model']:
                    raise SapError('Model chưa lưu. Hãy lưu file SAP2000 trước khi chọn để xuất nội lực.')
                entry['available'] = True
        except SapError as error:
            entry['error'] = str(error)
        result.append(entry)
    return result
