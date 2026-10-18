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
