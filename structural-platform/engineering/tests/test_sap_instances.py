from contextlib import contextmanager
from pathlib import PureWindowsPath
import pytest
from fastapi.testclient import TestClient
from structural_engine.member_forces.instances import scan_instances
from structural_engine.member_forces.dotnet import ConnectionSettings
from structural_engine.member_forces.connector import create_app
from structural_engine.member_forces.sap2000 import SapError, Sap2000
from test_sap2000_connector import FakeModel


def test_scan_reads_each_pid_and_file_without_mutating_model_or_binding_old_file():
    settings=ConnectionSettings(pid=999,dll_path='SAP2000v1.dll',expected_model='old.sdb')
    models={pid:FakeModel() for pid in [100,200]}
    @contextmanager
    def opener(target):
        assert target.dll_path==settings.dll_path and target.expected_model is None
        model=models[target.pid]
        model.GetModelFilename=lambda:str(PureWindowsPath(r'C:\Models')/(str(target.pid)+'.sdb'))
        yield Sap2000(model,connection_pid=target.pid)
    entries=scan_instances(settings,pid_provider=lambda:[100,200],opener=opener)
    assert [e['pid'] for e in entries]==[100,200]
    assert [e['filename'] for e in entries]==['100.sdb','200.sdb']
    assert all(e['available'] for e in entries)
    assert all(m.units==9 and m.case_selected['DEAD'] for m in models.values())


def test_failed_pid_and_unsaved_model_are_visible_and_other_entries_survive():
    @contextmanager
    def opener(settings):
        if settings.pid==100:
            raise SapError('Cannot attach to PID 100')
        model=FakeModel()
        if settings.pid==200:
            model.GetModelFilename=lambda:''
        yield Sap2000(model,connection_pid=settings.pid)
    entries=scan_instances(ConnectionSettings(),pid_provider=lambda:[100,200,300],opener=opener)
    assert [e['pid'] for e in entries]==[100,200,300]
    assert entries[0]['available'] is False and entries[0]['error']=='Cannot attach to PID 100'
    assert entries[1]['available'] is False and 'chưa lưu' in entries[1]['error']
    assert entries[2]['available'] is True
    assert scan_instances(ConnectionSettings(),pid_provider=lambda:[],opener=opener)==[]


def test_instance_route_auth_and_file_pinning_does_not_change_when_scanning():
    seen=[]
    def scanner(settings):
        seen.append(settings)
        return [{'pid':100,'filename':'Tower.sdb','model':r'C:\Models\Tower.sdb','available':True}]
    client=TestClient(create_app('x'*32,instance_scanner=scanner))
    base='/API_IF_SAP26.2.0_V1'
    assert client.get(base+'/instances').status_code==401
    headers={'Authorization':'Bearer '+'x'*32}
    result=client.get(base+'/instances',headers=headers)
    assert result.status_code==200 and result.json()['data'][0]['pid']==100
    client.put(base+'/connection',headers=headers,json={'pid':100,'expected_model':r'C:\Models\Tower.sdb'}).raise_for_status()
    client.get(base+'/instances',headers=headers).raise_for_status()
    assert client.get(base+'/connection',headers=headers).json()['pid']==100
    assert seen[-1].expected_model==r'C:\Models\Tower.sdb'


def test_selected_file_change_blocks_model_read_before_any_force_extraction():
    model=FakeModel()
    @contextmanager
    def gateway():
        yield Sap2000(model,connection_pid=100)
    client=TestClient(create_app('x'*32,gateway=gateway))
    headers={'Authorization':'Bearer '+'x'*32}
    base='/API_IF_SAP26.2.0_V1'
    client.put(base+'/connection',headers=headers,json={'pid':100,'expected_model':'model.sdb'}).raise_for_status()
    assert client.get(base+'/model',headers=headers).status_code==200
    model.GetModelFilename=lambda:'other.sdb'
    result=client.get(base+'/model',headers=headers)
    assert result.status_code==503 and 'SAP2000_MODEL_CHANGED' in result.json()['detail']
    assert model.units==9
