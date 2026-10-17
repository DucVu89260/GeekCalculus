import json
import subprocess
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from structural_engine.member_forces import worker
from structural_engine.member_forces.dotnet import ConnectionSettings
from structural_engine.member_forces.sap2000 import SapError
from structural_engine.member_forces.connector import create_app


def test_worker_protocol_utf8_pid_pin_and_extract_is_never_killed_on_timeout(monkeypatch):
    calls=[]
    def run(command,**kwargs):
        request=json.loads(kwargs['input'].decode('utf-8'))
        assert request['settings']['pid']==17340 and request['settings']['expected_model']=='A.sdb'
        calls.append((request,kwargs))
        data={'ok':True,'data':{'filename':'Mô hình.sdb'}}
        return SimpleNamespace(returncode=0,stdout=b'CLR noise\n'+worker.MARKER+json.dumps(data,ensure_ascii=False).encode())
    monkeypatch.setattr(worker.subprocess,'run',run)
    settings=ConnectionSettings(pid=17340,expected_model='A.sdb')
    assert worker.run_worker('model',settings)['filename']=='Mô hình.sdb'
    assert calls[-1][1]['timeout']==30
    worker.run_worker('extract',settings,{'output_cases':[]})
    assert calls[-1][1]['timeout'] is None
    with pytest.raises(SapError,match='Unsupported'):
        worker.run_worker('delete_model',settings)


def test_worker_errors_cannot_be_accepted_as_success(monkeypatch):
    settings=ConnectionSettings(pid=17340)
    monkeypatch.setattr(worker.subprocess,'run',lambda *a,**k:SimpleNamespace(returncode=1,stdout=worker.MARKER+b'{"ok":false,"error":"PID cannot attach"}'))
    with pytest.raises(SapError,match='PID cannot attach'):
        worker.run_worker('model',settings)
    monkeypatch.setattr(worker.subprocess,'run',lambda *a,**k:SimpleNamespace(returncode=1,stdout=b'bad output'))
    with pytest.raises(SapError,match='PROTOCOL'):
        worker.run_worker('model',settings)
    def timeout(*a,**k):raise subprocess.TimeoutExpired('worker',30)
    monkeypatch.setattr(worker.subprocess,'run',timeout)
    with pytest.raises(SapError,match='TIMEOUT'):
        worker.run_worker('model',settings)


def test_api_sends_selected_pid_and_model_to_runner_without_com_on_web_thread():
    seen=[]
    def runner(operation,settings,payload):
        seen.append((operation,settings,payload))
        return {'filename':'A.sdb','model':'A.sdb','pid':settings.pid}
    client=TestClient(create_app('x'*32,operation_runner=runner))
    headers={'Authorization':'Bearer '+'x'*32}
    base='/API_IF_SAP26.2.0_V1'
    client.put(base+'/connection',headers=headers,json={'pid':17340,'expected_model':'A.sdb'}).raise_for_status()
    assert client.get(base+'/model',headers=headers).json()['pid']==17340
    assert seen[-1][0]=='model' and seen[-1][1].expected_model=='A.sdb'


def test_real_worker_process_returns_a_controlled_platform_error_on_linux():
    import os
    if os.name=='nt':pytest.skip('Do not attach arbitrary test PID on a real Windows workstation')
    with pytest.raises(SapError,match='SAP2000_DOTNET_PLATFORM'):
        worker.run_worker('model',ConnectionSettings(pid=17340))
