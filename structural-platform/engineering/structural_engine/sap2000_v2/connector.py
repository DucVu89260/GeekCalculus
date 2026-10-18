"""Local-only V2 endpoints. V1 force DTOs/processing are reused unchanged."""
import os
from pathlib import Path
import secrets
import threading
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.trustedhost import TrustedHostMiddleware
from ..member_forces.connector import ConnectionRequest
from ..member_forces.dotnet import ConnectionSettings
from ..member_forces.instances import scan_instances
from ..member_forces.sap2000 import SapError, ExtractionRequest
from ..member_forces.api import execute as process, extremes, position_samples, export_connections
from ..member_forces.models import ExtremeRequest, PositionRequest, ExportRequest
from .contract import API_NAME, API_PREFIX, BUILD_ID, GROUPS, DEFAULT_GROUPS
from .models import SnapshotRequest, TableRequest
from .worker import run_worker


def create_app(token=None,operation_runner=None,instance_scanner=None):
    token=token if token is not None else os.environ.get('SAP2000_V2_TOKEN','')
    if len(token)<32:raise RuntimeError('V2 requires a random bearer token of at least32 characters')
    bearer=HTTPBearer(auto_error=False)
    def authenticate(credentials:HTTPAuthorizationCredentials|None=Depends(bearer)):
        if credentials is None or not secrets.compare_digest(credentials.credentials.encode(),token.encode()):
            raise HTTPException(401,'Invalid V2 connector token',headers={'WWW-Authenticate':'Bearer'})
    app=FastAPI(title=API_NAME,version='2.0',docs_url=None,redoc_url=None,openapi_url=None)
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost','testserver'])
    # No web origins enabled: local-first release only.
    lock=threading.Lock();settings=ConnectionSettings.from_environment()
    runner=operation_runner or run_worker
    def call(command,payload=None):
        with lock:
            try:return runner(command,settings,payload)
            except SapError as error:raise HTTPException(503,str(error)) from error
    auth=[Depends(authenticate)]
    @app.get('/',include_in_schema=False)
    def panel():
        return FileResponse(Path(__file__).with_name('panel.html'),headers={
            'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
            'Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"})
    @app.get(API_PREFIX+'/connection',dependencies=auth)
    def connection():
        with lock:return {'api_name':API_NAME,'build_id':BUILD_ID,'transport':'dotnet','pid':settings.pid,'dll_path':settings.dll_path,'expected_model':settings.expected_model}
    @app.put(API_PREFIX+'/connection',dependencies=auth)
    def configure(payload:ConnectionRequest):
        nonlocal settings
        with lock:
            settings=ConnectionSettings(pid=payload.pid,dll_path=payload.dll_path,expected_model=payload.expected_model)
            return {'api_name':API_NAME,'build_id':BUILD_ID,'transport':'dotnet','pid':settings.pid,'dll_path':settings.dll_path,'expected_model':settings.expected_model}
    @app.get(API_PREFIX+'/instances',dependencies=auth)
    def instances():
        with lock:
            try:data=(instance_scanner or scan_instances)(settings);return {'data':data,'count':len(data)}
            except SapError as error:raise HTTPException(503,str(error)) from error
    @app.get(API_PREFIX+'/model',dependencies=auth)
    def model():return call('model')
    @app.get(API_PREFIX+'/output-cases',dependencies=auth)
    def cases():return {'data':call('cases')}
    @app.get(API_PREFIX+'/selection',dependencies=auth)
    def selection():return call('selection')
    @app.get(API_PREFIX+'/members',dependencies=auth)
    def members():return call('members')
    @app.post(API_PREFIX+'/frame-forces',dependencies=auth)
    def forces(payload:ExtractionRequest):return call('extract',payload.model_dump(mode='json'))
    @app.post(API_PREFIX+'/extremes',dependencies=auth)
    def extreme(payload:ExtremeRequest):return process(extremes,payload)
    @app.post(API_PREFIX+'/position-samples',dependencies=auth)
    def positions(payload:PositionRequest):return process(position_samples,payload)
    @app.post(API_PREFIX+'/connection-export',dependencies=auth)
    def export(payload:ExportRequest):return export_connections(payload)
    @app.get(API_PREFIX+'/capabilities',dependencies=auth)
    def capabilities():return call('capabilities')
    @app.get(API_PREFIX+'/schema',dependencies=auth)
    def schema():return {'api_name':API_NAME,'build_id':BUILD_ID,'groups':GROUPS,'default_groups':DEFAULT_GROUPS,'snapshot_request':SnapshotRequest.model_json_schema(),'table_request':TableRequest.model_json_schema(),'force_contract':'API_IF_SAP26.2.0_V1 (preserved data schema only)'}
    @app.post(API_PREFIX+'/snapshot',dependencies=auth)
    def snapshot(payload:SnapshotRequest):return call('snapshot',payload.model_dump(mode='json'))
    @app.get(API_PREFIX+'/tables',dependencies=auth)
    def tables():return call('tables')
    @app.post(API_PREFIX+'/table',dependencies=auth)
    def table(payload:TableRequest):return call('table',payload.model_dump(mode='json'))
    return app
