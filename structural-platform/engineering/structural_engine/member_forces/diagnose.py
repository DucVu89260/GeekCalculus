"""Read-only Windows diagnostics; no token, model forces or credential output."""
import platform
import struct
import sys
from .sap2000 import SapError
from .dotnet import ConnectionSettings, connect_dotnet
import argparse


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--pid',type=int)
    parser.add_argument('--dll')
    args=parser.parse_args()
    settings=ConnectionSettings.from_environment()
    settings=ConnectionSettings(pid=args.pid if args.pid is not None else settings.pid,dll_path=args.dll or settings.dll_path)
    print('API_IF_SAP26.2.0_V1 - .NET DLL/PID diagnostics')
    print('Target PID:',settings.pid or 'automatic: exactly one SAP2000.exe required')
    print('DLL:',settings.dll_path)
    print('Windows/platform:', platform.system(), platform.release())
    print('Python:', platform.python_version(), str(struct.calcsize('P') * 8) + '-bit')
    print('Keep SAP2000 open with a saved model. Match Windows user/elevation levels.')
    try:
        with connect_dotnet(settings) as sap:
            print('.NET DLL/PID attachment: OK')
            version = sap.model.GetVersion()
            # Version is public product metadata, not a process environment dump.
            print('GetVersion normalized (outputs, return code):', repr(version))
            print('GetVersion result types:', [type(x).__name__ for x in version] if isinstance(version, (tuple,list)) else type(version).__name__)
            sap.verify_version()
            print('Version verification: OK')
            info = sap.model_info()
            print('Detected PID:', info['pid'])
            print('Model filename:', info['filename'])
            print('Model locked:', info['locked'])
            print('RESULT: Connection and model read succeeded.')
        return 0
    except Exception as error:
        print('RESULT: FAILED:', str(error) if isinstance(error, SapError) else type(error).__name__)
        print('Send the output above for troubleshooting; do not send a connector token.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
