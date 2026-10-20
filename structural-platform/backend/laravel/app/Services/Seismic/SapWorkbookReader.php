<?php

namespace App\Services\Seismic;

use SimpleXMLElement;
use ZipArchive;

/** Read values only. Never evaluate workbook formulas, macros or external links. */
final class SapWorkbookReader
{
    private function xml(ZipArchive $zip, string $name): SimpleXMLElement
    {
        $data = $zip->getFromName($name);
        Rules::require(is_string($data) && strlen($data) <= 12_000_000, "Missing/oversize XLSX part: $name");
        Rules::require(! preg_match('/<!DOCTYPE|<!ENTITY/i', $data), 'XML entities are not permitted');
        $old = libxml_use_internal_errors(true);
        try {
            $xml = simplexml_load_string($data, SimpleXMLElement::class, LIBXML_NONET);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($old);
        }
        Rules::require($xml !== false, "Malformed XLSX XML: $name");

        return $xml;
    }

    public function read(string $path, string $filename): array
    {
        $zip = new ZipArchive;
        Rules::require($zip->open($path) === true, 'Invalid XLSX archive');
        try {
            $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $st = $zip->statIndex($i);
                $total += $st['size'];
                Rules::require($total <= 40_000_000 && $zip->numFiles <= 2000, 'XLSX uncompressed-size/entry limit exceeded');
            }
            $strings = [];
            if ($zip->locateName('xl/sharedStrings.xml') !== false) {
                foreach ($this->xml($zip, 'xl/sharedStrings.xml')->xpath('//*[local-name()="si"]') as $si) {
                    $parts = $si->xpath('.//*[local-name()="t"]');
                    $strings[] = implode('', array_map(fn ($x) => (string) $x, $parts));
                }
            }
            $rels = [];
            foreach ($this->xml($zip, 'xl/_rels/workbook.xml.rels')->xpath('//*[local-name()="Relationship"]') as $r) {
                if ((string) $r['TargetMode'] === 'External') {
                    continue;
                }
                $target = (string) $r['Target'];
                Rules::require(! str_contains($target, '..'), 'Invalid worksheet target');
                $rels[(string) $r['Id']] = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.$target;
            }
            $sheets = [];
            foreach ($this->xml($zip, 'xl/workbook.xml')->xpath('//*[local-name()="sheet"]') as $s) {
                $id = (string) $s->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
                if (! isset($rels[$id])) {
                    continue;
                }
                $xml = $this->xml($zip, $rels[$id]);
                $rows = [];
                foreach ($xml->xpath('//*[local-name()="sheetData"]/*[local-name()="row"]') as $row) {
                    Rules::require(count($rows) < 20000, 'Maximum 20000 rows per sheet');
                    $cells = [];
                    foreach ($row->xpath('./*[local-name()="c"]') as $cell) {
                        preg_match('/^([A-Z]+)(\d+)$/', (string) $cell['r'], $m);
                        Rules::require(isset($m[2]), 'Invalid cell address');
                        $col = 0;
                        foreach (str_split($m[1]) as $letter) {
                            $col = $col * 26 + ord($letter) - 64;
                        } Rules::require($col <= 100, 'Maximum 100 columns');
                        $v = $cell->xpath('./*[local-name()="v"]');
                        $value = (string) ($v[0] ?? '');
                        $formulas = $cell->xpath('./*[local-name()="f"]');
                        Rules::require(! $formulas || $value !== '', 'Formula has no cached value; export SAP2000 values, not formulas');
                        if ((string) $cell['t'] === 's') {
                            $value = $strings[(int) $value] ?? '';
                        } elseif ((string) $cell['t'] === 'inlineStr') {
                            $value = implode('', array_map(fn ($x) => (string) $x, $cell->xpath('.//*[local-name()="t"]')));
                        }
                        $cells[$col - 1] = $value;
                    }
                    if ($cells) {
                        $dense = array_fill(0, max(array_keys($cells)) + 1, '');
                        foreach ($cells as $i => $v) {
                            $dense[$i] = $v;
                        }$rows[] = ['row' => (int) $row['r'], 'cells' => $dense];
                    }
                }
                // Preserve merge metadata for preview; don't expand merged values into fake data records.
                $merges = array_map(fn ($x) => (string) $x['ref'], $xml->xpath('//*[local-name()="mergeCell"]'));
                $sheets[] = ['name' => (string) $s['name'], 'rows' => $rows, 'merged_cells' => $merges];
            }
            Rules::require(count($sheets) > 0 && count($sheets) <= 50, 'XLSX requires 1–50 sheets');

            return ['schema_version' => 'sap-seismic-sheets/1', 'origin' => 'excel', 'filename' => basename($filename), 'sha256' => hash_file('sha256', $path), 'imported_at' => gmdate(DATE_ATOM), 'sheets' => $sheets];
        } finally {
            $zip->close();
        }
    }
}
