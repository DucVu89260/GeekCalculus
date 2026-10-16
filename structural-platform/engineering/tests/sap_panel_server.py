"""Browser-test fixture only. Never connects to a real SAP2000 instance.

From engineering: PYTHONPATH=. .venv/bin/python tests/sap_panel_server.py
"""
from contextlib import contextmanager
import uvicorn
from test_sap2000_connector import FakeModel
from structural_engine.member_forces.connector import create_app
from structural_engine.member_forces.sap2000 import Sap2000


@contextmanager
def gateway():
    yield Sap2000(FakeModel(), connection_pid=20948)


if __name__ == '__main__':
    uvicorn.run(create_app('sap-panel-browser-test-token-00000001', gateway), host='127.0.0.1', port=8011)
