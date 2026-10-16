import subprocess
from types import SimpleNamespace
import pytest
from structural_engine.member_forces import processes
from structural_engine.member_forces.sap2000 import SapError, Sap2000


def test_tasklist_csv_exact_name_localization_and_pid_parsing():
    output='"SAP2000.exe","20948","Console","1","100,000 K"\r\n"SAP2000.exe","20948","Console","1","1 K"\r\n"SAP2000.exe.bak","99","Console"\r\n'
    assert processes.parse_tasklist(output)==[20948]
    assert processes.parse_tasklist('INFO: No tasks are running which match the specified criteria.')==[]
    with pytest.raises(SapError):
        processes.parse_tasklist('"SAP2000.exe","bad"')


def test_discovery_requires_exactly_one_process_and_rescans_after_restart(monkeypatch):
    monkeypatch.setattr(processes,'running_sap2000_pids',lambda:[])
    with pytest.raises(SapError,match='SAP2000_NOT_RUNNING'):
        processes.discover_sap2000_pid()
    monkeypatch.setattr(processes,'running_sap2000_pids',lambda:[20948])
    assert processes.discover_sap2000_pid()==20948
    monkeypatch.setattr(processes,'running_sap2000_pids',lambda:[34567])
    assert processes.discover_sap2000_pid()==34567
    monkeypatch.setattr(processes,'running_sap2000_pids',lambda:[20948,34567])
    with pytest.raises(SapError,match='SAP2000_MULTIPLE_INSTANCES'):
        processes.discover_sap2000_pid()


def test_windows_query_failure_is_not_treated_as_no_running_sap(monkeypatch):
    # Exercise the subprocess boundary on Linux without changing pathlib's OS selection.
    monkeypatch.setattr(processes,'os',SimpleNamespace(name='nt',environ={}))
    calls=[]
    def run(command,**kwargs):
        calls.append(command)
        assert kwargs['timeout']==10 and kwargs['check'] is False
        return SimpleNamespace(returncode=0,stdout=b'"SAP2000.exe","20948","Console","1","1 K"')
    monkeypatch.setattr(processes.subprocess,'run',run)
    assert processes.running_sap2000_pids()==[20948]
    assert calls[0][1:]==['/FI','IMAGENAME eq SAP2000.exe','/FO','CSV','/NH']
    monkeypatch.setattr(processes.subprocess,'run',lambda *a,**k:SimpleNamespace(returncode=1))
    with pytest.raises(SapError,match='query failed'):
        processes.running_sap2000_pids()
    def timeout(*args,**kwargs):
        raise subprocess.TimeoutExpired('tasklist',10)
    monkeypatch.setattr(processes.subprocess,'run',timeout)
    with pytest.raises(SapError,match='Cannot query'):
        processes.running_sap2000_pids()


def test_model_identity_reports_the_actual_attached_pid():
    from test_sap2000_connector import FakeModel
    assert Sap2000(FakeModel(),connection_pid=20948).model_info()['pid']==20948


def test_automatic_attachment_uses_the_discovered_pid_not_com_active_object(monkeypatch):
    from structural_engine.member_forces.dotnet import attach_application
    monkeypatch.setattr(processes,'running_sap2000_pids',lambda:[20948])
    expected=object()
    class Helper:
        def GetObjectProcess(self,progid,pid):
            assert progid=='CSI.SAP2000.API.SapObject' and pid==20948
            return expected
        def GetObject(self,progid):
            raise AssertionError('Automatic attachment must use discovered PID')
    assert attach_application(Helper(),None) is expected
    monkeypatch.setattr(processes,'running_sap2000_pids',lambda:[20948,34567])
    with pytest.raises(SapError,match='MULTIPLE_INSTANCES'):
        attach_application(Helper(),None)
