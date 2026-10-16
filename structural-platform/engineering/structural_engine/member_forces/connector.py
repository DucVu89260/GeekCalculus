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
from .api import router
from .contract import API_NAME, API_PREFIX
from .sap2000 import ExtractionRequest, SapError, connect


def create_app(token=None, gateway=connect):
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
    lock = threading.Lock()

    def call(operation):
        # Serialize all changes to SAP2000 global output selection and units.
        with lock:
            try:
                with gateway() as sap:
                    sap.verify_version()
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

    @app.get(API_PREFIX + '/model', dependencies=[Depends(authenticate)])
    def active_model():
        return call(lambda sap: sap.model_info())

    @app.get(API_PREFIX + '/output-cases', dependencies=[Depends(authenticate)])
    def output_cases():
        return {'data': call(lambda sap: sap.cases())}

    @app.get(API_PREFIX + '/selection', dependencies=[Depends(authenticate)])
    def selection():
        return call(lambda sap: {**sap.model_info(), 'frames': sap.selection()})

    @app.post(API_PREFIX + '/frame-forces', dependencies=[Depends(authenticate)])
    def frame_forces(payload: ExtractionRequest):
        return call(lambda sap: sap.extract(payload))

    app.include_router(router, dependencies=[Depends(authenticate)])
    return app
