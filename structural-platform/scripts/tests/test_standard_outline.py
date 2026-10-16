"""Synthetic extraction tests; licensed sources never become test fixtures."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import fitz

SCRIPT = Path(__file__).parents[1] / 'extract_standard_outline.py'
spec = importlib.util.spec_from_file_location('standard_outline', SCRIPT)
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class SourceIndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'synthetic.pdf'

    def tearDown(self):
        self.temp.cleanup()

    def source(self, leading_blanks=0, year=2010):
        doc = fitz.open()
        cover = doc.new_page(width=522, height=792)
        cover.insert_text((40, 70), f'ANSI/AISC 360-{str(year)[-2:]} June 22, {year}')
        for _ in range(leading_blanks):
            doc.new_page(width=522, height=792)
        a = doc.new_page(width=522, height=792)
        a.insert_text((30, 25), '16.1-1')
        a.insert_text((160, 70), 'CHAPTER A', fontname='hebo', fontsize=17)
        a.insert_text((100, 100), 'GENERAL PROVISIONS', fontsize=17)
        a.insert_text((35, 150), 'A1.', fontname='hebo', fontsize=12.2)
        a.insert_text((80, 150), 'SCOPE', fontname='hebo', fontsize=12.2)
        a.insert_text((410, 200), '(E3-1)')
        a.insert_text((40, 250), 'TABLE B4.1a')
        j = doc.new_page(width=522, height=792)
        j.insert_text((30, 25), '16.1-105')
        j.insert_text((160, 70), 'CHAPTER J', fontname='hebo', fontsize=17)
        j.insert_text((100, 100), 'DESIGN OF CONNECTIONS', fontsize=17)
        appendix = doc.new_page(width=522, height=792)
        appendix.insert_text((30, 25), '16.1-183')
        appendix.insert_text((160, 70), 'APPENDIX 1', fontname='hebo', fontsize=17)
        appendix.insert_text((100, 100), 'DESIGN BY INELASTIC ANALYSIS', fontsize=17)
        appendix.insert_text((410, 210), '(A-1-1)')
        commentary = doc.new_page(width=522, height=792)
        commentary.insert_text((30, 25), '16.1-241')
        commentary.insert_text((40, 80), 'COMMENTARY\non the Specification', fontsize=16)
        commentary.insert_text((410, 200), '(E3-1)')
        doc.set_toc([[1, 'CHAP J-DESIGN OF CONNECTIONS', 5 + leading_blanks]])
        doc.save(self.path)
        doc.close()
        return extractor.extract(self.path)

    def test_identity_is_actual_content_not_filename(self):
        with self.assertRaisesRegex(ValueError, 'identity'):
            self.source(year=2016)

    def test_disabled_edition_cannot_be_imported(self):
        self.source()
        with self.assertRaisesRegex(ValueError, 'not enabled'):
            extractor.inspect_pdf(self.path, 'AISC360-16')

    def test_measured_boundaries_shift_with_source_pagination(self):
        result = self.source(leading_blanks=4)
        self.assertEqual(result['boundaries']['specification_start'], 6)
        self.assertEqual(result['boundaries']['commentary_start'], 9)
        self.assertEqual(result['pdf_page_count'], 9)
        self.assertEqual(result['pages'][5]['printed_page_label'], '16.1-1')
        self.assertIsNone(result['pages'][2]['printed_page_label'])

    def test_content_heading_precedes_misplaced_bookmark(self):
        result = self.source()
        chapter = next(row for row in result['clauses'] if row['code'] == 'J')
        self.assertEqual(chapter['kind'], 'normative')
        self.assertEqual(chapter['pdf_page'], 3)
        self.assertEqual(result['raw_bookmarks'][0]['pdf_page'], 5)
        section = next(row for row in result['clauses'] if row['code'] == 'A1')
        self.assertEqual(section['parent_code'], 'A')
        self.assertEqual(section['title'], 'SCOPE')

    def test_equation_scopes_and_appendix_labels_are_indexed_not_inferred(self):
        result = self.source()
        shared = [row for row in result['equation_candidates'] if row['label'] == 'E3-1']
        self.assertEqual({row['kind'] for row in shared}, {'normative', 'commentary'})
        appendix = next(row for row in result['equation_candidates'] if row['label'] == 'A-1-1')
        self.assertEqual(appendix['clause_code'], 'APPENDIX1')
        for row in result['equation_candidates']:
            self.assertEqual(row['verification_status'], 'candidate')
            self.assertNotIn('latex', row)
            self.assertEqual(row['source_anchor']['page'], row['pdf_page'])
        self.assertEqual(result['report']['verified_equations'], 0)

    def test_table_candidate_has_no_invented_cells(self):
        result = self.source()
        table = result['table_candidates'][0]
        self.assertEqual(table['label'], 'B4.1a')
        self.assertEqual(table['rows'], [])
        self.assertEqual(table['columns'], [])
        self.assertEqual(table['verification_status'], 'candidate')

    def test_malformed_pdf_rejected(self):
        self.path.write_bytes(b'Not a PDF')
        with self.assertRaisesRegex(ValueError, 'PDF'):
            extractor.inspect_pdf(self.path)

    def test_source_metadata_and_hash_deterministic(self):
        self.source()
        first = extractor.inspect_pdf(self.path)
        second = extractor.inspect_pdf(self.path)
        self.assertEqual(first, second)
        self.assertEqual(len(first['source_sha256']), 64)
        self.assertTrue(first['source_identity']['validated'])
        self.assertEqual(first['source_identity']['edition_year'], 2010)


if __name__ == '__main__':
    unittest.main()
