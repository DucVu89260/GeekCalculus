"""Test-only local V2 server with synthetic models; never included in Windows kit."""
from contextlib import contextmanager
import uvicorn
from sap_v2_fixtures import SteelModel,FixtureRuntime,gateway
from structural_engine.sap2000_v2.connector import create_app
from structural_engine.sap2000_v2.worker import execute
from structural_engine.member_forces.sap2000 import SapError

MODELS={20948:SteelModel(),34567:SteelModel()}
MODELS[20948].GetModelFilename=lambda:r'C:\Fixtures\V2-steel.sdb'
MODELS[34567].GetModelFilename=lambda:r'C:\Fixtures\V2-other.sdb'
@contextmanager
def opener(settings):
    if settings.pid not in MODELS:raise SapError('Synthetic unavailable PID')
    with gateway(MODELS[settings.pid]) as sap:
        sap.connection_pid=settings.pid;yield sap

class BrowserRuntime(FixtureRuntime):
    def read(self,key,**inputs):
        if key=='design_summary' and inputs.get('Name')=='F2':
            from structural_engine.sap2000_v2.reflection import block
            return block('empty','DesignSteel.GetSummaryResults',data={'NumberItems':0,'FrameName':[]})
        return super().read(key,**inputs)

def runner(operation,settings,payload=None):
    return execute(operation,settings,payload,opener=opener,runtime_factory=BrowserRuntime)

def scanner(settings):
    return [{'pid':pid,'model':model.GetModelFilename(),'filename':model.GetModelFilename().split('\\')[-1],
             'available':True,'locked':True,'error':None} for pid,model in MODELS.items()]

if __name__=='__main__':
    uvicorn.run(create_app('v2-browser-test-token-000000000000000000',operation_runner=runner,instance_scanner=scanner),host='127.0.0.1',port=8012)
