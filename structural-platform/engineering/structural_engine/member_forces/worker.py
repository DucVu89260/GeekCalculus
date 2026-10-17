"""Execute each SAP2000 job in an isolated Python main process, like the proven CMD path."""
from dataclasses import asdict
import json
from pathlib import Path
import subprocess
import sys
from .dotnet import ConnectionSettings
from .sap2000 import SapError

MARKER=b'SAP2000_WORKER_RESULT:'
OPERATIONS={'model','cases','selection','extract'}


def run_worker(operation,settings,payload=None):
    if operation not in OPERATIONS:
        raise SapError('SAP2000_WORKER: Unsupported operation')
    request={'operation':operation,'settings':asdict(settings),'payload':payload}
    try:
        response=subprocess.run([sys.executable,'-m','structural_engine.member_forces.worker'],
            input=json.dumps(request,ensure_ascii=False).encode('utf-8'),
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False,
            cwd=str(Path(__file__).resolve().parents[2]),
            # Never kill extraction: its finally block must restore units/output selections.
            timeout=None if operation=='extract' else 30,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired as error:
        raise SapError(f'SAP2000_WORKER_TIMEOUT: PID {settings.pid} không phản hồi thao tác chỉ đọc trong 30 giây. Kiểm tra hộp thoại SAP2000 rồi quét lại.') from error
    except OSError as error:
        raise SapError('SAP2000_WORKER_START: Cannot start the isolated Python worker.') from error
    try:
        result=json.loads(response.stdout.rsplit(MARKER,1)[1].decode('utf-8'))
        if not isinstance(result,dict) or not isinstance(result.get('ok'),bool) or (result['ok'] and 'data' not in result):
            raise ValueError()
    except (ValueError,IndexError,UnicodeError) as error:
        raise SapError(f'SAP2000_WORKER_PROTOCOL: Worker exited with code {response.returncode} without a valid result.') from error
    if not result['ok']:
        raise SapError(str(result.get('error','SAP2000 worker failed')))
    if response.returncode!=0:
        raise SapError(f'SAP2000_WORKER_EXIT: Worker exited with code {response.returncode}; no result accepted.')
    return result['data']


def execute(request):
    from .dotnet import connect_dotnet
    from .sap2000 import ExtractionRequest
    operation=request['operation']
    if operation not in OPERATIONS:
        raise SapError('Unsupported worker operation')
    settings=ConnectionSettings(**request['settings'])
    with connect_dotnet(settings) as sap:
        sap.verify_version()
        if operation=='model':return sap.model_info()
        if operation=='cases':return sap.cases()
        if operation=='selection':return {**sap.model_info(),'frames':sap.selection()}
        return sap.extract(ExtractionRequest.model_validate(request['payload'])).model_dump(mode='json')


def main():
    try:
        request=json.loads(sys.stdin.buffer.read().decode('utf-8'))
        result={'ok':True,'data':execute(request)}
    except Exception as error:
        result={'ok':False,'error':str(error) if isinstance(error,SapError) else 'SAP2000_WORKER: '+type(error).__name__}
    sys.stdout.buffer.write(b'\n'+MARKER+json.dumps(result,ensure_ascii=False,allow_nan=False).encode('utf-8')+b'\n')
    sys.stdout.buffer.flush()
    return 0 if result['ok'] else 1


if __name__=='__main__':
    sys.exit(main())
