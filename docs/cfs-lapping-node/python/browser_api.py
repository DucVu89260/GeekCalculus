"""Browser-only I/O adapter around the unmodified portable Python modules.

All paths live in the worker's in-memory filesystem, never the user's disk.
No HTTP server, tkinter, external commands or execution of user-provided code.
"""
import base64
import json
import math
import re
import shutil
from pathlib import Path
from adapter import normalize
from cfsa_insert import export_copy
from cfsa_reader import read_cfsa

ROOT = Path('/cfs-workspace')
INCOMING = Path('/cfs-incoming')
SOURCE = None
MAX_SOURCE = 10_000_000
MAX_SECTIONS = 50_000_000


def filename(name, suffix):
    if not isinstance(name, str) or not name or len(name) > 240:
        raise ValueError('Invalid filename')
    if any(c in name for c in ('/', '\\', '\x00')) or name in ('.', '..'):
        raise ValueError('Only a filename is accepted')
    if not name.lower().endswith(suffix):
        raise ValueError('Expected ' + suffix + ' file')
    return name


def draft_model(value):
    if not isinstance(value, dict) or value.get('schema_version') != 3:
        raise ValueError('Expected schema_version 3 draft')
    for key, cap in (('members', 100), ('supports', 200)):
        if not isinstance(value.get(key), list) or not 1 <= len(value[key]) <= cap:
            raise ValueError('Invalid draft ' + key)
    if not isinstance(value.get('loadings'), dict) or len(value['loadings']) > 60:
        raise ValueError('Invalid draft loadings')
    def number(item, key):
        x = item.get(key)
        if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x):
            raise ValueError('Invalid finite numeric field: ' + key)
        return x
    def integer(item, key):
        x = number(item, key)
        if not isinstance(x, int) or abs(x) > 1_000_000:
            raise ValueError('Invalid integer field: ' + key)
        return x
    for member in value['members']:
        if not isinstance(member, dict):
            raise ValueError('Invalid member')
        integer(member, 'id')
        filename(member.get('section_file'), '.cfss')
        if not isinstance(member.get('section'), str) or not isinstance(member.get('section_found'), bool):
            raise ValueError('Invalid section reference')
        for key in ('start_m', 'end_m', 'start_native', 'end_native'):
            number(member, key)
        if member['start_m'] >= member['end_m']:
            raise ValueError('Invalid member coordinate order')
    for support in value['supports']:
        if not isinstance(support, dict):
            raise ValueError('Invalid support')
        integer(support, 'id')
        code = integer(support, 'type_code')
        if not 0 <= code <= 255 or not re.fullmatch(r'[0-9a-fA-F]{4}', support.get('flags_hex', '')):
            raise ValueError('Invalid support flags/type')
        for key in ('x_m', 'location_native', 'bearing_native', 'k'):
            number(support, key)
    for name, rows in value['loadings'].items():
        if not isinstance(name, str) or len(name) > 20 or not isinstance(rows, list) or len(rows) > 100:
            raise ValueError('Invalid loading case')
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError('Invalid loading row')
            integer(row, 'type_code')
            for key in ('start_m', 'end_m', 'w_start_native', 'w_end_native', 'angle_radians', 'factor'):
                number(row, key)
    bearings = value.get('bearing_positions_m')
    if not isinstance(bearings, list) or len(bearings) > 200:
        raise ValueError('Invalid bearing positions')
    for x in bearings:
        number({'x': x}, 'x')
    if not isinstance(value.get('sections_directory'), str):
        raise ValueError('Invalid section directory label')
    catalog = value.get('section_catalog')
    if not isinstance(catalog, list) or len(catalog) > 4000:
        raise ValueError('Invalid section catalog')
    for entry in catalog:
        filename(entry, '.cfss')
    source = value.get('source')
    if not isinstance(source, dict) or not re.fullmatch(r'[0-9a-f]{64}', source.get('sha256', '')):
        raise ValueError('Invalid source identity')
    if 'combinations' in value:
        raise ValueError('Top-level combinations are prohibited')
    if len(json.dumps(value, allow_nan=False).encode()) > 2_000_000:
        raise ValueError('Draft exceeds 2 MB')
    return value


def handle(payload):
    global SOURCE
    op = payload.get('op')
    if op == 'validate-draft':
        return draft_model(payload.get('draft'))
    if op == 'import':
        name = filename(payload.get('name'), '.cfsa')
        data = base64.b64decode(payload['data'], validate=True)
        if not 1 <= len(data) <= MAX_SOURCE:
            raise ValueError('CFSA must be at most 10 MB')
        sections = payload.get('sections', [])
        if not isinstance(sections, list) or len(sections) > 2000:
            raise ValueError('Select at most 2000 section files')
        # Stage everything before replacing the currently imported project.
        staged = {}
        total = 0
        for section in sections:
            section_name = filename(section.get('name'), '.cfss')
            key = section_name.casefold()
            if key in staged:
                raise ValueError('Duplicate section filename: ' + section_name)
            contents = base64.b64decode(section['data'], validate=True)
            total += len(contents)
            if total > MAX_SECTIONS:
                raise ValueError('Section selection exceeds 50 MB')
            staged[key] = (section_name, contents)
        incoming = INCOMING
        shutil.rmtree(incoming, ignore_errors=True)
        (incoming / 'SECTIONS').mkdir(parents=True)
        path = incoming / name
        path.write_bytes(data)
        for section_name, contents in staged.values():
            (incoming / 'SECTIONS' / section_name).write_bytes(contents)
        # Match Windows case-insensitive section references without changing bytes.
        for member in read_cfsa(path)['members']:
            reference = Path(member['section_file'].replace('\\', '/')).name
            if reference.casefold() in staged:
                filename(reference, '.cfss')
                (incoming / 'SECTIONS' / reference).write_bytes(staged[reference.casefold()][1])
        result = normalize(path)
        shutil.rmtree(ROOT, ignore_errors=True)
        incoming.rename(ROOT)
        SOURCE = ROOT / name
        # Virtual worker paths have no meaning outside the browser.
        result['sections_directory'] = 'SECTIONS (browser selection)'
        result['section_catalog'] = sorted(name for name, _ in staged.values())
        return result
    if op == 'export':
        if payload.get('acknowledge') != 'EXPERIMENTAL_COPY_ONLY':
            raise ValueError('Explicit experimental-copy acknowledgment required')
        if SOURCE is None or not SOURCE.is_file():
            raise ValueError('Re-import the original CFSA and SECTIONS before exporting a saved draft')
        draft = draft_model(payload.get('draft'))
        result = export_copy(SOURCE, draft)
        output = Path(result['output'])
        try:
            result['data'] = base64.b64encode(output.read_bytes()).decode('ascii')
            result['output'] = output.name
            return result
        finally:
            # Only remove the generated virtual copy, never the imported source.
            output.unlink(missing_ok=True)
    raise ValueError('Unsupported browser operation')


def dispatch(request_json):
    try:
        result = handle(json.loads(request_json))
        return json.dumps({'ok': True, 'result': result}, ensure_ascii=False, allow_nan=False)
    except (ValueError, TypeError, KeyError, OSError, IndexError, OverflowError):
        # Stable friendly failure; do not expose Python tracebacks in the UI.
        import sys
        return json.dumps({'ok': False, 'error': str(sys.exception())}, ensure_ascii=False)
