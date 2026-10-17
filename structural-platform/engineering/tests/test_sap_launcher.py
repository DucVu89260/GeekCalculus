import socket
import pytest
from structural_engine.member_forces.run_connector import ensure_port_available


def test_busy_port_prevents_browser_and_new_connector():
    with socket.socket() as listener:
        try:
            listener.bind(('127.0.0.1', 8010))
        except OSError:
            pytest.skip('Port 8010 belongs to another local service')
        listener.listen()
        with pytest.raises(SystemExit, match='stop-sap2000-panel.cmd'):
            ensure_port_available()
