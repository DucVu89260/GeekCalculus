"""Synthetic sources only: extraction integrity and image-only page OCR."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import fitz

SCRIPT = Path(__file__).resolve().parents[1] / 'extract_asce710_corpus.py'
spec = importlib.util.spec_from_file_location('asce_extract', SCRIPT)
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class CorpusExtractionTest(unittest.TestCase):
    def test_references_are_candidates_with_exact_offsets_not_executable_formulas(self):
        text = 'See Table 27.3-1 and Figure 27.4-1. q = 0.613 Kz V2 (27.3-1).'
        items = extractor.inventory(text, 'native')
        self.assertEqual({r['kind'] for r in items}, {'equation','table','figure'})
        for row in items:
            self.assertIn(row['label'], text[row['offset']:])
            self.assertEqual(row['verification_status'], 'candidate')
            self.assertEqual(row['occurrence_type'], 'reference_or_definition')
        self.assertIn('0.613', [m.group() for m in extractor.NUMBERS.finditer(text)])

    def test_image_only_page_retains_pixels_and_ocr_in_separate_channel(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'pages').mkdir()
            image_doc = fitz.open(); p = image_doc.new_page(width=600,height=300)
            p.insert_text((40,100), 'Table 27.3-1 Exposure B C D', fontsize=22)
            pixels = p.get_pixmap(dpi=160).tobytes('png')
            pdf = fitz.open(); page = pdf.new_page(width=600,height=300)
            page.insert_image(page.rect,stream=pixels); pdf.save(root/'input.pdf'); pdf.close()
            row = extractor.process_page((str(root/'input.pdf'), str(root), 0))
            self.assertEqual(row['native_text'], '')
            self.assertEqual(row['extraction_method'],'native+ocr')
            self.assertIn('27.3-1',row['ocr_text'])
            self.assertTrue(row['ocr_words_tsv'])
            self.assertTrue(any(i['kind']=='table' for i in row['items']))
            self.assertEqual(row['image_sha256'],extractor.digest((root/row['image_path']).read_bytes()))


if __name__ == '__main__':
    unittest.main()
