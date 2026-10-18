"""V2 jobs execute on a fresh process main thread; stateful reads are never killed."""
from dataclasses import asdict
import json
from pathlib import Path
import subprocess
import sys
from ..member_forces.dotnet import ConnectionSettings, connect_dotnet
from ..member_forces.sap2000 import SapError, ExtractionRequest
from .models import SnapshotRequest, TableRequest
from .reader import SteelReader
from .reflection import RuntimeReader
from .registry import GETTERS
from .contract import API_NAME, BUILD_ID

MARKER=b'SAP2000_V2_RESULT:'
OPERATIONS={'model','cases','selection','members','extract','capabilities','snapshot','tables','table'}


def execute(operation,settings,payload=None,*,opener=None,runtime_factory=None):
    if operation not in OPERATIONS:raise SapError('Unsupported V2 operation')
    with (opener or connect_dotnet)(settings) as sap:
        sap.verify_version()
        if settings.expected_model is not None and sap.model.GetModelFilename()!=settings.expected_model:
            raise SapError('SAP2000_MODEL_CHANGED: Reconnect to the intended model')
        if operation=='model':return {**sap.model_info(),'api_name':API_NAME,'build_id':BUILD_ID}
        if operation=='cases':return sap.cases()
        if operation=='selection':return {**sap.model_info(),'api_name':API_NAME,'frames':sap.selection()}
        if operation=='members':return {**sap.model_info(),'api_name':API_NAME,'data':[m.model_dump(mode='json') for m in sap.member_info()]}
        if operation=='extract':return sap.extract(ExtractionRequest.model_validate(payload)).model_dump(mode='json')
        runtime=(runtime_factory or RuntimeReader)(sap.model)
        reader=SteelReader(sap,runtime)
        if operation=='capabilities':
            return {'api_name':API_NAME,'build_id':BUILD_ID,'model':sap.model.GetModelFilename(),
                    'pid':sap.connection_pid,'data':[runtime.describe(key) for key in GETTERS]}
        if operation=='tables':return reader.read('tables')
        if operation=='table':return reader.table(TableRequest.model_validate(payload))
        return reader.snapshot(SnapshotRequest.model_validate(payload))


def run_worker(operation,settings,payload=None):
    if operation not in OPERATIONS:raise SapError('Unsupported V2 operation')
    try:
        result=subprocess.run([sys.executable,'-m','structural_engine.sap2000_v2.worker'],
            input=json.dumps({'operation':operation,'settings':asdict(settings),'payload':payload},ensure_ascii=False).encode(),
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False,
            cwd=str(Path(__file__).resolve().parents[2]),
            timeout=None if operation in ('extract','snapshot','table') else 60,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired as error:raise SapError('SAP2000_V2_TIMEOUT: SAP is not responding; close its dialog and retry') from error
    except OSError as error:raise SapError('SAP2000_V2_WORKER: Cannot start Python worker') from error
    try:
        response=json.loads(result.stdout.rsplit(MARKER,1)[1].decode())
        if not isinstance(response,dict) or not isinstance(response.get('ok'),bool):raise ValueError()
        if not response['ok']:raise SapError(response.get('error','V2 read failed'))
        if result.returncode!=0 or 'data' not in response:raise ValueError()
        return response['data']
    except (ValueError,IndexError,UnicodeError) as error:raise SapError('SAP2000_V2_WORKER_PROTOCOL: No valid result; no data accepted') from error


def main():
    try:
        request=json.loads(sys.stdin.buffer.read().decode())
        value=execute(request['operation'],ConnectionSettings(**request['settings']),request.get('payload'))
        result={'ok':True,'data':value}
    except Exception as error:
        result={'ok':False,'error':str(error) if isinstance(error,SapError) else 'SAP2000_V2_WORKER: '+type(error).__name__}
    try:encoded=json.dumps(result,ensure_ascii=False,allow_nan=False).encode()
    except (ValueError,TypeError):
        result={'ok':False,'error':'SAP2000_V2_WORKER: Invalid non-JSON result'};encoded=json.dumps(result).encode()
    sys.stdout.buffer.write(b'\n'+MARKER+encoded+b'\n');sys.stdout.buffer.flush()
    return 0 if result['ok'] else 1


if __name__=='__main__':sys.exit(main())
