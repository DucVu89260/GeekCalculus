"""Source-only local V2 kit, isolated from the published V1 distribution."""
from pathlib import Path
import hashlib
import json
import zipfile


def main():
    repo = Path(__file__).resolve().parents[2]
    source = repo / 'structural-platform/engineering'
    output = repo / 'downloads/API_IF_SAP26.2.0_V2.zip'
    output.parent.mkdir(exist_ok=True)
    names = ['requirements-test.lock', 'requirements-windows.txt',
             'start-sap2000-v2.cmd', 'diagnose-sap2000-v2.cmd', 'bootstrap-sap2000-env.py',
             'install-web-launcher-v2.cmd', 'install-web-launcher-v2.ps1', 'open-sap2000-v2-web.ps1',
             'SAP2000-API-V2.md', 'structural_engine/__init__.py']
    files = [source / name for name in names]
    for folder in ('sap2000_v2', 'member_forces', 'design'):
        files += [p for p in (source / 'structural_engine' / folder).rglob('*')
                  if p.is_file() and p.suffix in ('.py', '.html', '.json', '.mjs')
                  and '__pycache__' not in p.parts]
    manifest = {}
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            name = path.relative_to(source).as_posix()
            data = path.read_bytes()
            if path.suffix == '.cmd':
                data = path.read_text().replace('\r\n', '\n').replace('\n', '\r\n').encode()
            archive.writestr(name, data)
            manifest[name] = hashlib.sha256(data).hexdigest()
        assets = json.loads((source / 'structural_engine/sap2000_v2/steel_component_assets.json').read_text())
        for filename in assets:
            name = 'structural_engine/sap2000_v2/steel_component/' + filename
            data = (repo / 'structural-platform/frontend/vue/public' / filename).read_bytes()
            archive.writestr(name, data)
            manifest[name] = hashlib.sha256(data).hexdigest()
        alias=(source / 'install-web-launcher-v2.cmd').read_text().replace('\r\n','\n').replace('\n','\r\n').encode()
        archive.writestr('install-web-launcher.cmd',alias)
        manifest['install-web-launcher.cmd']=hashlib.sha256(alias).hexdigest()
        archive.writestr('manifest.sha256.json', json.dumps(manifest, indent=2))
        archive.writestr('BAT-DAU.txt',
            'SAP2000-API V2 web/local release — 2026.10.20-v2-max-length.1\n'
            'Extract ALL files to C:\\geek_calculus\\SAP2000-API\n'
            'Stop the old connector with Ctrl+C; keep SAP2000 26.2.0 open.\n'
            'Python 3.13 x64 + py recommended on each PC; 3.12/3.11 x64 also supported.\n'
            'Startup repairs machine-specific .venv automatically; old .venv is backed up.\n'
            'Python runtime is not bundled. First dependency installation needs Internet.\n'
            'Run install-web-launcher.cmd once to upgrade the web protocol to V2.\n'
            'Then click SAP2000-API on GeekCalculus; keep the connector running.\n'
            'Read SAP2000-API-V2.md for Vietnamese/English instructions and preview limits.\n'
            'Actual Windows/SAP validation is pending. Hosted V2 panel supported.\n')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.zip.sha256').write_text(digest + '  ' + output.name + '\n')
    print(f'{output}: {output.stat().st_size} bytes; SHA256={digest}')


if __name__ == '__main__':
    main()
