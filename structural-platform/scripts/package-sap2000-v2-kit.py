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
             'start-sap2000-v2.cmd', 'diagnose-sap2000-v2.cmd',
             'SAP2000-API-V2.md', 'structural_engine/__init__.py']
    files = [source / name for name in names]
    for folder in ('sap2000_v2', 'member_forces', 'design'):
        files += [p for p in (source / 'structural_engine' / folder).rglob('*')
                  if p.is_file() and p.suffix in ('.py', '.html', '.json')
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
        archive.writestr('manifest.sha256.json', json.dumps(manifest, indent=2))
        archive.writestr('BAT-DAU.txt',
            'SAP2000-API V2 local preview — 2026.10.18-v2-local.4\n'
            'Extract ALL files to C:\\geek_calculus\\SAP2000-API\\V2\n'
            'Stop V1 connector with Ctrl+C; keep SAP2000 26.2.0 open.\n'
            'Run start-sap2000-v2.cmd at the same Windows user/elevation as SAP.\n'
            'Read SAP2000-API-V2.md for Vietnamese/English instructions and preview limits.\n'
            'Actual Windows/SAP validation is pending. No website changes.\n')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.zip.sha256').write_text(digest + '  ' + output.name + '\n')
    print(f'{output}: {output.stat().st_size} bytes; SHA256={digest}')


if __name__ == '__main__':
    main()
