"""Browser fixture only: multiple fake SAP2000 models, never real COM attachment.

From engineering: PYTHONPATH=. .venv/bin/python tests/sap_panel_server.py
"""
from contextlib import contextmanager
import uvicorn
from test_sap2000_connector import FakeModel
import structural_engine.member_forces.connector as connector
from structural_engine.member_forces.instances import scan_instances
from structural_engine.member_forces.sap2000 import Sap2000, SapError

MODELS={20948:FakeModel(),34567:FakeModel()}
MODELS[20948].GetModelFilename=lambda:r'C:\Models\Tower A.sdb'
MODELS[34567].GetModelFilename=lambda:r'C:\Models\Tower B.sdb'


@contextmanager
def gateway(settings):
    if settings.pid not in MODELS:
        raise SapError('Không đọc được PID 56789; kiểm tra quyền Windows.')
    yield Sap2000(MODELS[settings.pid],connection_pid=settings.pid,section_type_names={1:'I',99:'NONPRISMATIC'})


def scanner(settings):
    return scan_instances(settings,pid_provider=lambda:[20948,34567,56789],opener=gateway)


def runner(operation,settings,payload=None):
    from structural_engine.member_forces.sap2000 import ExtractionRequest
    with gateway(settings) as sap:
        sap.verify_version()
        if settings.expected_model is not None and sap.model.GetModelFilename()!=settings.expected_model:
            raise SapError('SAP2000_MODEL_CHANGED: File changed; rescan.')
        if operation=='model':return sap.model_info()
        if operation=='cases':return sap.cases()
        if operation=='members':return {'model':sap.model_info()['model'],'pid':sap.connection_pid,'data':[m.model_dump() for m in sap.member_info()]}
        if operation=='selection':return {**sap.model_info(),'frames':sap.selection()}
        return sap.extract(ExtractionRequest.model_validate(payload)).model_dump(mode='json')


if __name__ == '__main__':
    # Test-only injection: production still uses the real direct-DLL connection factory.
    uvicorn.run(connector.create_app('sap-panel-browser-test-token-00000001',instance_scanner=scanner,operation_runner=runner),host='127.0.0.1',port=8011)
