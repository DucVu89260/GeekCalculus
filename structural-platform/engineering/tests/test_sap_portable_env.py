"""Portability regression: copied environments are disposable machine-local state."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import pytest

_spec=importlib.util.spec_from_file_location('sap_bootstrap',Path(__file__).resolve().parents[1]/'bootstrap-sap2000-env.py')
bootstrap=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(bootstrap)


def test_real_environment_creation_and_reuse_preserves_user_files(tmp_path,monkeypatch):
    monkeypatch.setattr(bootstrap,'port_in_use',lambda:False)
    (tmp_path/'model-note.txt').write_text('keep')
    first=bootstrap.ensure_environment(tmp_path)
    assert first['action']=='created' and first['python']['bits']==64
    assert first['python']['version'][:2]==list(sys.version_info[:2])
    second=bootstrap.ensure_environment(tmp_path)
    assert second['action']=='reused' and second['backup'] is None
    assert not list(tmp_path.glob('.venv-backup-*'))
    assert (tmp_path/'model-note.txt').read_text()=='keep'


def test_broken_copied_environment_is_archived_then_rebuilt_with_current_python(tmp_path,monkeypatch):
    monkeypatch.setattr(bootstrap,'port_in_use',lambda:False)
    old=tmp_path/'.venv';old.mkdir()
    (old/'pyvenv.cfg').write_text(r'home = C:\Users\ADMIN\AppData\Local\Programs\Python\Python313')
    (old/'private-marker.txt').write_text('do not delete')
    result=bootstrap.ensure_environment(tmp_path)
    assert result['action']=='rebuilt'
    backup=Path(result['backup'])
    assert backup.parent==tmp_path and backup.name.startswith('.venv-backup-')
    assert (backup/'private-marker.txt').read_text()=='do not delete'
    assert 'ADMIN' in (backup/'pyvenv.cfg').read_text()
    assert 'ADMIN' not in (old/'pyvenv.cfg').read_text()
    assert bootstrap.inspect_environment(tmp_path)['bits']==64


@pytest.mark.parametrize('version,bits,prefix_ok,valid',[
    ([3,11,9],64,True,True),([3,12,9],64,True,True),([3,13,9],64,True,True),
    ([3,15,0],64,True,False),([3,13,9],32,True,False),([3,13,9],64,False,False),
])
def test_probe_requires_supported_64bit_interpreter_and_current_prefix(tmp_path,monkeypatch,version,bits,prefix_ok,valid):
    executable=bootstrap.environment_python(tmp_path);executable.parent.mkdir(parents=True);executable.touch()
    info={'version':version,'bits':bits,'prefix':str(tmp_path/'.venv' if prefix_ok else tmp_path/'other-machine'),'executable':str(executable)}
    monkeypatch.setattr(bootstrap.subprocess,'run',lambda *a,**kw:SimpleNamespace(returncode=0,stdout=json.dumps(info)))
    assert bool(bootstrap.inspect_environment(tmp_path)) is valid


def test_missing_base_executable_matches_reported_failure(tmp_path,monkeypatch):
    executable=bootstrap.environment_python(tmp_path);executable.parent.mkdir(parents=True);executable.touch()
    monkeypatch.setattr(bootstrap.subprocess,'run',lambda *a,**kw:SimpleNamespace(returncode=103,stdout='',stderr='did not find executable at C:\\Users\\ADMIN\\Python313\\python.exe'))
    assert bootstrap.inspect_environment(tmp_path) is None


def test_active_connector_blocks_repair_without_renaming_environment(tmp_path,monkeypatch):
    old=tmp_path/'.venv';old.mkdir();(old/'marker').write_text('keep')
    monkeypatch.setattr(bootstrap,'inspect_environment',lambda r:None)
    monkeypatch.setattr(bootstrap,'port_in_use',lambda:True)
    with pytest.raises(bootstrap.BootstrapError,match='Port 8010'):bootstrap.ensure_environment(tmp_path)
    assert (old/'marker').read_text()=='keep' and not list(tmp_path.glob('.venv-backup-*'))


def test_read_only_check_does_not_modify_broken_environment(tmp_path,monkeypatch):
    old=tmp_path/'.venv';old.mkdir();(old/'marker').write_text('keep')
    monkeypatch.setattr(bootstrap.sys,'argv',['bootstrap','--root',str(tmp_path),'--check'])
    assert bootstrap.main()==1
    assert (old/'marker').read_text()=='keep' and not list(tmp_path.glob('.venv-backup-*'))


def test_launcher_never_chooses_unversioned_py_or_requires_old_username():
    root=Path(__file__).resolve().parents[1]
    script=(root/'start-sap2000-v2.cmd').read_text()
    assert 'for %%V in (3.13 3.12 3.11)' in script
    assert 'py -3 -m venv' not in script
    assert 'bootstrap-sap2000-env.py --check' in script and 'goto environment_ready' in script
    assert '.runtime\\python.exe' in script
    assert 'Users\\ADMIN' not in script
