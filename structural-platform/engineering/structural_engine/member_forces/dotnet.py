"""SAP2000 .NET bridge: typed ref/out arguments, no COM Helper registration.

Reflection uses declared CSI interfaces, including enum/ref/array parameter types.
It converts return-first .NET calls into the return-last internal adapter contract.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
import os
from pathlib import Path

DEFAULT_DLL = r'C:\Program Files\Computers and Structures\SAP2000 26\SAP2000v1.dll'


@dataclass(frozen=True)
class ConnectionSettings:
    pid: int | None = None
    dll_path: str = DEFAULT_DLL
    expected_model: str | None = None

    @classmethod
    def from_environment(cls):
        from .sap2000 import SapError
        value = os.environ.get('SAP2000_PID', '')
        try:
            pid = int(value) if value else None
            if pid is not None and not 0 < pid <= 2147483647:
                raise ValueError()
        except ValueError as error:
            raise SapError('SAP2000_PID must be a positive process ID. Check Task Manager > Details.') from error
        return cls(pid=pid, dll_path=os.environ.get('SAP2000_DLL', DEFAULT_DLL))


def normalize(value, system):
    if value is None:
        return None
    if isinstance(value, system.Array):
        return [normalize(x, system) for x in value]
    if hasattr(value, 'GetType') and value.GetType().IsEnum:
        return int(system.Convert.ToInt32(value))
    return value


def members(interface):
    """Include inherited interfaces; COM runtime classes may expose no methods."""
    return [interface, *interface.GetInterfaces()]


class DotNetProxy:
    def __init__(self, target, interface, system):
        self._target = target
        self._interface = interface
        self._system = system

    def __getattr__(self, name):
        from .sap2000 import SapError
        for interface in members(self._interface):
            prop = interface.GetProperty(name)
            if prop is not None:
                target = prop.GetValue(self._target, None)
                return DotNetProxy(target, prop.PropertyType, self._system)
        methods = [m for i in members(self._interface) for m in i.GetMethods() if m.Name == name]
        if not methods:
            raise SapError(f'SAP2000_DOTNET_SIGNATURE: Missing API member {name}')

        def invoke(*inputs):
            candidates = []
            for method in methods:
                parameters = list(method.GetParameters())
                required = sum(not p.ParameterType.IsByRef and not p.IsOptional for p in parameters)
                total = sum(not p.ParameterType.IsByRef for p in parameters)
                if required <= len(inputs) <= total:
                    candidates.append((method, parameters))
            if len(candidates) != 1:
                raise SapError(f'SAP2000_DOTNET_SIGNATURE: Ambiguous/unsupported parameters for {name}')
            method, parameters = candidates[0]
            system = self._system
            values, refs, types = [], [], []
            source = iter(inputs)
            for index, parameter in enumerate(parameters):
                target_type = parameter.ParameterType
                if target_type.IsByRef:
                    target_type = target_type.GetElementType()
                    refs.append(index)
                    # CSI initializes these ref/out arguments, including result arrays.
                    value = system.Activator.CreateInstance(target_type) if target_type.IsValueType else None
                else:
                    try:
                        value = next(source)
                    except StopIteration:
                        value = parameter.DefaultValue
                    if target_type.IsEnum:
                        value = system.Enum.ToObject(target_type, int(normalize(value, system)))
                    elif value is not None:
                        value = system.Convert.ChangeType(value, target_type)
                values.append(value)
                types.append(target_type)
            arguments = system.Array[system.Object]([None] * len(values))
            for index, (kind, value) in enumerate(zip(types, values)):
                # Pythonnet unboxes Int32 into Python int. Object[] would box it as
                # PyInt, invalid for Int32&. CLR Array.Copy preserves exact boxing.
                typed = system.Array.CreateInstance(kind, 1)
                if value is not None:
                    typed[0] = value
                system.Array.Copy(typed, 0, arguments, index, 1)
            try:
                result = method.Invoke(self._target, arguments)
            except Exception as error:
                cause = getattr(error, 'InnerException', None) or error
                hresult = getattr(cause, 'HResult', None)
                code = f' HRESULT=0x{int(hresult) & 0xffffffff:08X}' if hresult is not None else ''
                raise SapError(f'SAP2000_DOTNET_CALL: {name} failed{code}. Check the selected SAP2000 PID and model.') from error
            result = normalize(result, system)
            if refs:
                return (*[normalize(arguments[i], system) for i in refs], result)
            return result
        return invoke


def attach_application(helper, pid):
    from .sap2000 import SapError, com_operation
    if pid is None:
        from .processes import discover_sap2000_pid
        pid = discover_sap2000_pid()
    application = com_operation('SAP2000_ATTACH_PID', lambda: helper.GetObjectProcess('CSI.SAP2000.API.SapObject', pid))
    # An explicit PID must never silently attach to a different instance.
    if application is None:
        from .access import access_report, access_hint
        raise SapError('SAP2000_ATTACH: '+access_hint(access_report(pid)))
    return application


@contextmanager
def connect_dotnet(settings: ConnectionSettings):
    from .sap2000 import Sap2000, SapError, com_operation
    if os.name != 'nt':
        raise SapError('SAP2000_DOTNET_PLATFORM: Run this connector on Windows alongside SAP2000.')
    from .processes import discover_sap2000_pid
    pid = settings.pid if settings.pid is not None else discover_sap2000_pid()
    path = Path(settings.dll_path)
    if path.name.lower() != 'sap2000v1.dll' or not path.is_file():
        raise SapError('SAP2000_DLL_NOT_FOUND: Choose SAP2000v1.dll from the main SAP2000 26 installation folder, not NativeAPI.')
    try:
        try:
            import clr
            import System
        except ImportError as error:
            raise SapError('SAP2000_DOTNET_IMPORT: Install requirements-windows.txt (pythonnet) using the connector venv.') from error
        com_operation('SAP2000_DLL_LOAD', lambda: clr.AddReference(str(path.resolve())))
        from SAP2000v1 import Helper, cHelper, cSapModel
        helper = com_operation('SAP2000_DOTNET_HELPER', lambda: cHelper(Helper()))
        application = attach_application(helper, pid)
        model = com_operation('SAP2000_MODEL', lambda: cSapModel(application.SapModel))
        sap = Sap2000(DotNetProxy(model, clr.GetClrType(cSapModel), System), connection_pid=pid)
        if settings.expected_model is not None and sap.model.GetModelFilename() != settings.expected_model:
            raise SapError('SAP2000_MODEL_CHANGED: File trong PID đã đổi. Quét lại danh sách và chọn đúng model trước khi tiếp tục.')
        yield sap
    except SapError:
        raise
    except Exception as error:
        raise SapError('SAP2000_DOTNET_READ: ' + type(error).__name__ + '. Run diagnose-sap2000.cmd with the same --pid and --dll settings.') from error
