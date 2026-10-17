"""Windows-only loopback API. Start in the same user session as SAP2000."""
import os
import logging
import secrets
import threading
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.cors import CORSMiddleware
from .api import router
from .contract import API_NAME, API_PREFIX, BUILD_ID
from .sap2000 import ExtractionRequest, SapError
from .dotnet import ConnectionSettings, connect_dotnet
from .models import Model, Name
from .instances import scan_instances
from .worker import run_worker
from pydantic import Field


WEB_ORIGINS = (
    'http://geekcalculus.com', 'https://geekcalculus.com',
    'http://geekcalculus.test', 'https://geekcalculus.test',
    'https://ducvu89260.github.io',
)


class ConnectionRequest(Model):
    pid: int | None = Field(default=None, strict=True, gt=0, le=2147483647)
    expected_model: Name | None = None
    dll_path: str = Field(default=ConnectionSettings().dll_path, min_length=1, max_length=1000)


def create_app(token=None, gateway=None, instance_scanner=None, operation_runner=None):
    token = token if token is not None else os.environ.get('SAP2000_CONNECTOR_TOKEN', '')
    if len(token) < 32:
        raise RuntimeError('Set SAP2000_CONNECTOR_TOKEN to a random token of at least 32 characters')
    bearer = HTTPBearer(auto_error=False)

    def authenticate(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), token.encode()):
            raise HTTPException(401, 'Invalid connector bearer token', headers={'WWW-Authenticate': 'Bearer'})

    app = FastAPI(title=API_NAME, version='1',
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', 'testserver'])
    app.add_middleware(CORSMiddleware, allow_origins=WEB_ORIGINS,
                       allow_methods=['GET','POST','PUT'], allow_headers=['Authorization','Content-Type'],
                       allow_private_network=True, allow_credentials=False)
    lock = threading.Lock()
    settings = ConnectionSettings.from_environment()

    def call(operation, command, payload=None):
        # Serialize all changes to SAP2000 global output selection and units.
        with lock:
            try:
                if gateway is None:
                    return (operation_runner or run_worker)(command,settings,payload)
                with (gateway() if gateway is not None else connect_dotnet(settings)) as sap:
                    sap.verify_version()
                    if settings.expected_model is not None and sap.model.GetModelFilename() != settings.expected_model:
                        raise SapError('SAP2000_MODEL_CHANGED: File trong PID đã đổi. Quét lại danh sách và chọn đúng model trước khi tiếp tục.')
                    return operation(sap)
            except SapError as error:
                logging.getLogger('uvicorn.error').warning('SAP2000 connection/read failed: %s', error)
                raise HTTPException(503, str(error)) from error

    @app.get('/', include_in_schema=False)
    def panel():
        return FileResponse(Path(__file__).with_name('panel.html'), headers={
            'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            'X-Content-Type-Options': 'nosniff',
        })

    @app.get(API_PREFIX + '/connection', dependencies=[Depends(authenticate)])
    def connection_info():
        with lock:
            return {'build_id': BUILD_ID, 'transport': 'dotnet', 'pid': settings.pid, 'dll_path': settings.dll_path, 'expected_model': settings.expected_model}

    @app.put(API_PREFIX + '/connection', dependencies=[Depends(authenticate)])
    def configure_connection(payload: ConnectionRequest):
        nonlocal settings
        with lock:
            settings = ConnectionSettings(pid=payload.pid, dll_path=payload.dll_path, expected_model=payload.expected_model)
            return {'build_id': BUILD_ID, 'transport': 'dotnet', 'pid': settings.pid, 'dll_path': settings.dll_path, 'expected_model': settings.expected_model}

    @app.get(API_PREFIX + '/instances', dependencies=[Depends(authenticate)])
    def available_instances():
        with lock:
            try:
                entries = (instance_scanner or scan_instances)(settings)
                return {'data': entries, 'count': len(entries)}
            except SapError as error:
                raise HTTPException(503, str(error)) from error

    @app.get(API_PREFIX + '/model', dependencies=[Depends(authenticate)])
    def active_model():
        return call(lambda sap: sap.model_info(),'model')

    @app.get(API_PREFIX + '/output-cases', dependencies=[Depends(authenticate)])
    def output_cases():
        return {'data': call(lambda sap: sap.cases(),'cases')}

    @app.get(API_PREFIX + '/selection', dependencies=[Depends(authenticate)])
    def selection():
        return call(lambda sap: {**sap.model_info(), 'frames': sap.selection()},'selection')

    @app.get(API_PREFIX + '/members', dependencies=[Depends(authenticate)])
    def members():
        return call(lambda sap: {'model': sap.model_info()['model'], 'pid': sap.connection_pid,
                                'data': [m.model_dump() for m in sap.member_info()]}, 'members')

    @app.post(API_PREFIX + '/frame-forces', dependencies=[Depends(authenticate)])
    def frame_forces(payload: ExtractionRequest):
        return call(lambda sap: sap.extract(payload),'extract',payload.model_dump(mode='json'))

    app.include_router(router, dependencies=[Depends(authenticate)])
    return app
