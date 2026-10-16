from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response
from .contract import API_NAME, API_PREFIX
from .models import ExportRequest, ExtremeRequest
from .processing import connection_export, extremes

router = APIRouter(prefix=API_PREFIX, tags=[API_NAME])


def execute(fn, payload):
    try:
        return fn(payload)
    except ValueError as error:
        return JSONResponse(status_code=422, content={'status': 'error', 'code': 'INVALID_FORCE_DATA', 'message': str(error)})


@router.post('/extremes')
def extreme_cases(payload: ExtremeRequest):
    return execute(extremes, payload)


@router.post('/connection-export')
def export_connections(payload: ExportRequest):
    result = execute(connection_export, payload)
    if isinstance(result, str):
        return Response(result, media_type='text/csv', headers={'Content-Disposition': 'attachment; filename="member-forces.csv"'})
    return result
