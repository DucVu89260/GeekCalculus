import base64
import copy
import hashlib
import json
import re
from pathlib import Path
import struct
import sys
import tempfile
import unittest

from fixtures import fixture, SECTION, OPAQUE, INCH_M

PYTHON = Path(__file__).resolve().parents[2] / 'frontend/vue/public/cfs-lapping-node/python'
sys.path.insert(0, str(PYTHON))
import browser_api as api


def encoded(name, data):
    return {'name': name, 'data': base64.b64encode(data).decode()}


class BrowserAdapterTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        api.ROOT = Path(self.temp.name) / 'project'
        api.INCOMING = Path(self.temp.name) / 'incoming'
        api.SOURCE = None
        self.original, self.offsets = fixture()
        self.draft = self.import_model()

    def import_model(self, data=None, sections=None):
        return api.handle({'op': 'import', **encoded('synthetic.cfsa', self.original if data is None else data),
                           'sections': [encoded('Z200.cfss', SECTION)] if sections is None else sections})

    def export(self, draft):
        result = api.handle({'op': 'export', 'draft': draft, 'acknowledge': 'EXPERIMENTAL_COPY_ONLY'})
        self.assertTrue(result['combinations_unchanged'])
        self.assertEqual(api.SOURCE.read_bytes(), self.original)
        self.assertEqual((api.ROOT / 'SECTIONS/Z200.cfss').read_bytes(), SECTION)
        self.assertFalse(list(api.ROOT.glob('*_WEBTEST*')))
        return base64.b64decode(result['data'])

    def test_import_negative_domain_and_unverified_units(self):
        self.assertEqual(self.draft['geometry_min_m'], -1)
        self.assertEqual(self.draft['geometry_max_m'], 13)
        self.assertEqual(self.draft['total_length_m'], 14)
        self.assertEqual(self.draft['overlaps'][0]['length_m'], 1)
        self.assertIn('unverified', self.draft['source']['support_type_mapping'])
        self.assertIn('unknown', self.draft['source']['native_load_units'])
        self.assertEqual(self.draft['source']['sha256'], hashlib.sha256(self.original).hexdigest())

    def test_lap_export_changes_only_independent_expected_float_offsets(self):
        self.draft['members'][0]['end_m'] = 6.9
        self.draft['members'][1]['start_m'] = 5.2
        data = self.export(self.draft)
        expected = bytearray(self.original)
        struct.pack_into('<f', expected, self.offsets['member_offsets'][0] + 4, 6.9 / INCH_M)
        struct.pack_into('<f', expected, self.offsets['member_offsets'][1], 5.2 / INCH_M)
        self.assertEqual(data, expected)
        self.assertTrue(data.endswith(OPAQUE))
        # Repeated downloads never overwrite the source or retain a generated copy.
        self.assertEqual(self.export(self.draft), data)

    def test_xt_insert_and_delete_preserve_all_other_bytes(self):
        for insert in (True, False):
            with self.subTest(insert=insert):
                draft = copy.deepcopy(self.draft)
                if insert:
                    added = dict(draft['supports'][1], id=-1, is_new=True, x_m=4)
                    draft['supports'].append(added)
                    draft['supports'].sort(key=lambda support: support['x_m'])
                else:
                    del draft['supports'][1]
                data = self.export(draft)
                count = self.offsets['count_offset']
                before = self.original[count + 1:self.offsets['end_table']]
                records = [before[i:i + 15] for i in range(0, len(before), 15)]
                if insert:
                    added_bytes = bytearray(records[1])
                    struct.pack_into('<f', added_bytes, 1, 4 / INCH_M)
                    records.insert(2, added_bytes)
                else:
                    del records[1]
                expected = self.original[:count] + bytes([len(records)]) + b''.join(records) + self.original[self.offsets['end_table']:]
                self.assertEqual(data, expected)
                self.assertTrue(data.endswith(OPAQUE))

    def test_reject_source_hash_main_bearing_and_section_changes(self):
        for mutate in (
            lambda d: d['source'].update(sha256='0' * 64),
            lambda d: d['supports'][0].update(x_m=1),
            lambda d: d['members'][0].update(section='OTHER'),
        ):
            draft = copy.deepcopy(self.draft)
            mutate(draft)
            with self.assertRaises(ValueError): self.export(draft)
            self.assertEqual(api.SOURCE.read_bytes(), self.original)

    def test_missing_sections_acknowledgment_and_unknown_header(self):
        with self.assertRaises(ValueError): api.handle({'op': 'export', 'draft': self.draft})
        missing = self.import_model(sections=[])
        self.assertTrue(missing['warnings'])
        with self.assertRaises(ValueError): self.export(missing)
        with self.assertRaises(ValueError): self.import_model(data=b'not a cfsa')

    def test_saved_draft_requires_reimport_and_is_json_only(self):
        self.assertEqual(api.handle({'op': 'validate-draft', 'draft': self.draft}), self.draft)
        api.SOURCE = None
        with self.assertRaisesRegex(ValueError, 'Re-import'): self.export(self.draft)
        hostile = copy.deepcopy(self.draft)
        hostile['members'][0]['id'] = '<img src=x onerror=alert(1)>'
        with self.assertRaises(ValueError): api.draft_model(hostile)
        hostile = copy.deepcopy(self.draft)
        hostile['supports'][0]['x_m'] = float('nan')
        with self.assertRaises(ValueError): api.draft_model(hostile)

    def test_paths_duplicate_sections_and_case_insensitive_reference(self):
        with self.assertRaises(ValueError): api.filename('../outside.cfsa', '.cfsa')
        with self.assertRaises(ValueError): api.filename('C:\\outside.cfsa', '.cfsa')
        with self.assertRaises(ValueError): self.import_model(sections=[encoded('Z200.cfss', SECTION), encoded('z200.cfss', SECTION)])
        model = self.import_model(sections=[encoded('z200.CFSS', SECTION)])
        self.assertEqual(model['warnings'], [])
        self.assertEqual(model['section_catalog'], ['z200.CFSS'])

    def test_error_contract_has_no_traceback(self):
        result = json.loads(api.dispatch(json.dumps({'op': 'export', 'draft': {}})))
        self.assertFalse(result['ok'])
        self.assertNotIn('Traceback', result['error'])

    def test_uploaded_python_and_ui_algorithms_are_unchanged(self):
        public = PYTHON.parent
        manifest = json.loads((public / 'upstream-manifest.json').read_text())
        for name, expected in manifest['python_files'].items():
            self.assertEqual(hashlib.sha256((PYTHON / name).read_bytes()).hexdigest(), expected, name)
        html = (public / 'index.html').read_text()
        for name, expected in manifest['ui_functions'].items():
            start = html.index('function ' + name + '(')
            boundary = re.search(r"\nfunction |\nel\('chooseFile'\)", html[start + 1:])
            end = start + 1 + boundary.start() if boundary else len(html)
            self.assertEqual(hashlib.sha256(html[start:end].rstrip().encode()).hexdigest(), expected, name)


if __name__ == '__main__': unittest.main()
