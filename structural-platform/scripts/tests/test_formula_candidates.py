"""Synthetic page-layout tests; no actual AISC equations are verified here."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).parents[1]))
from extract_aisc_formula_candidates import candidates, simple_expression


class FormulaCandidateTests(unittest.TestCase):
    def source(self, path, blanks=0):
        with fitz.open() as doc:
            p = doc.new_page(width=522, height=792)
            p.insert_text((30, 70), 'ANSI/AISC 360-10 June 22, 2010')
            for _ in range(blanks):
                doc.new_page(width=522, height=792)
            p = doc.new_page(width=522, height=792)
            p.insert_text((30, 25), '16.1-1')
            p.insert_text((100, 70), 'CHAPTER A')
            p.insert_text((100, 100), 'GENERAL PROVISIONS')
            p = doc.new_page(width=522, height=792)
            p.insert_text((30, 25), '16.1-33')
            p.insert_text((100, 70), 'CHAPTER E')
            p.insert_text((70, 200), 'P_n = F_cr A_g')
            p.insert_text((410, 200), '(E3-1)')
            # Multiline exponent/fraction: never concatenate it into invented LaTeX.
            p.insert_text((70, 300), 'F_cr =')
            p.insert_text((160, 280), 'Fy/Fe')
            p.insert_text((410, 300), '(E3-2)')
            p.insert_text((40, 400), 'See Equation (F2-1) for a related provision.')
            p = doc.new_page(width=522, height=792)
            p.insert_text((30, 25), '16.1-241')
            p.insert_text((30, 70), 'COMMENTARY\non the Specification')
            p.insert_text((410, 200), '(E3-1)')
            doc.save(path)

    def test_exact_page_hash_and_ambiguous_layout_stays_untranscribed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.pdf'
            self.source(path, blanks=3)
            result = candidates(path)
            self.assertEqual(result['source_sha256'], hashlib.sha256(path.read_bytes()).hexdigest())
            rows = {r['label']: r for r in result['equations']}
            self.assertEqual(set(rows), {'E3-1', 'E3-2', 'F2-1'})
            self.assertEqual(rows['E3-1']['pdf_page'], 6)
            self.assertEqual(rows['E3-1']['latex'], 'P_{n} = F_{cr} A_{g}')
            self.assertIsNone(rows['E3-2']['latex'])
            self.assertIsNone(rows['F2-1']['latex'], 'references are not definitions')
            for row in rows.values():
                self.assertIn(row['verification_status'], ['candidate', 'needs_review'])
                self.assertEqual(row['variables'], [])
                self.assertEqual(row['conditions'], [])
                self.assertEqual(row['asd_lrfd_factors'], [])
                self.assertEqual(row['evidence']['text_sha256'], hashlib.sha256(row['evidence']['text'].encode()).hexdigest())

    def test_chapter_selection_and_no_guessed_expression(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.pdf'
            self.source(path)
            self.assertEqual([r['label'] for r in candidates(path, ('F',))['equations']], ['F2-1'])
            with self.assertRaises(ValueError):
                candidates(path, ('J',))
        for line in ['See E3-2', 'Q =', 'Q = sqrt(a/b)', 'Q = a ^ 2', 'Q = (a']:
            self.assertIsNone(simple_expression([line]))


if __name__ == '__main__':
    unittest.main()
