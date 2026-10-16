"""Adapter contract tests: real CLR coverage is in the optional CLR fixture test."""
import pytest
from fastapi.testclient import TestClient
from structural_engine.member_forces.connector import create_app
from structural_engine.member_forces.dotnet import ConnectionSettings
from structural_engine.member_forces.sap2000 import SapError


def test_pid_settings_are_explicit_and_validated(monkeypatch):
    monkeypatch.setenv('SAP2000_PID','20948')
    assert ConnectionSettings.from_environment().pid==20948
    monkeypatch.setenv('SAP2000_PID','-1')
    with pytest.raises(SapError):
        ConnectionSettings.from_environment()


def test_configuration_is_authenticated_and_pid_is_not_silently_coerced():
    client=TestClient(create_app('x'*32))
    path='/API_IF_SAP26.2.0_V1/connection'
    assert client.get(path).status_code==401
    headers={'Authorization':'Bearer '+'x'*32}
    assert client.put(path,headers=headers,json={'pid':'20948'}).status_code==422
    assert client.put(path,headers=headers,json={'pid':0}).status_code==422
    result=client.put(path,headers=headers,json={'pid':20948})
    assert result.status_code==200 and result.json()['pid']==20948
    assert client.get(path,headers=headers).json()['transport']=='dotnet'


def test_explicit_pid_does_not_fallback_to_another_model():
    from structural_engine.member_forces.dotnet import attach_application
    class Helper:
        def GetObjectProcess(self, progid, pid):
            assert pid == 20948
            return None
        def GetObject(self, progid):
            raise AssertionError('Must not silently select another SAP instance')
    with pytest.raises(SapError, match='PID'):
        attach_application(Helper(), 20948)
