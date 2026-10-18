"""Regression: Windows launcher must install the web server, not only pythonnet."""
from pathlib import Path
import re


def test_v2_launcher_installs_complete_pinned_dependency_closure():
    root = Path(__file__).resolve().parents[1]
    launcher = (root / 'start-sap2000-v2.cmd').read_text()
    install = next(line for line in launcher.splitlines() if '-m pip install ' in line)
    requirements = re.findall(r'-r\s+(\S+)', install)
    packages = set()
    for filename in requirements:
        for line in (root / filename).read_text().splitlines():
            if '==' in line and not line.startswith('#'):
                packages.add(line.split('==', 1)[0].casefold())
    assert {'uvicorn', 'fastapi', 'pydantic', 'pythonnet'} <= packages
    assert 'import uvicorn,fastapi,pydantic,clr' in launcher
    assert launcher.index('import uvicorn,fastapi,pydantic,clr') < launcher.index('-m structural_engine.sap2000_v2.run_connector')


def test_v2_protocol_upgrade_uses_fixed_root_own_token_and_normal_uac():
    root=Path(__file__).resolve().parents[1]
    launch=(root/'open-sap2000-v2-web.ps1').read_text()
    install=(root/'install-web-launcher-v2.ps1').read_text()
    start=(root/'start-sap2000-v2.cmd').read_text()
    assert "C:\\geek_calculus\\SAP2000-API" in start and 'SAP2000-API\\V2' not in start
    assert '-Verb RunAs' in launch and 'connector-v2-token.dpapi' in launch
    assert 'API_IF_SAP26.2.0_V2/connection' in launch and 'web_panel_supported' in launch
    assert 'SAP2000_V2_TOKEN' in launch and 'start-sap2000-v2.cmd' in launch
    assert 'open-sap2000-v2-web.ps1' in install and 'HKCU:' in install
    assert 'Stop-Process' not in launch and 'taskkill' not in launch


def test_v2_web_url_reuses_exact_approved_panel_validation():
    import argparse
    import pytest
    from structural_engine.sap2000_v2.run_connector import checked_web_url
    good='https://ducvu89260.github.io/GeekCalculus/sap2000-api/26.2.0/?lang=vi'
    assert checked_web_url(good)==good
    for bad in ['https://attacker.example/sap2000-api/26.2.0/',good+'#token=private','https://ducvu89260.github.io/GeekCalculus/other/']:
        with pytest.raises(argparse.ArgumentTypeError):checked_web_url(bad)
