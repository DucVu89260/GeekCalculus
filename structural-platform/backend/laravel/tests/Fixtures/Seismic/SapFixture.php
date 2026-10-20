<?php

namespace Tests\Fixtures\Seismic;

use ZipArchive;

/** Synthetic SAP table export; no real project/account data. */
final class SapFixture
{
    public static function tables(): array
    {
        return [
            ['table_key' => 'Mass Source Definitions', 'model' => 'synthetic.sdb', 'truncated' => false, 'columns' => ['MassSource', 'LoadPat', 'SF', 'MassFromElements', 'AdditionalMass', 'MassFromLoads'], 'rows' => [['MS1', 'DEAD', '1', 'No', 'No', 'Yes'], ['MS1', 'LIVE', '0.25', 'No', 'No', 'Yes'], ['MS1', 'ROOF', '0', 'No', 'No', 'Yes']]],
            ['table_key' => 'Mass Summary by Group', 'model' => 'synthetic.sdb', 'truncated' => false, 'columns' => ['MassSource', 'MassX', 'MassY'], 'rows' => [['MS1', '100000', '100000']]],
            ['table_key' => 'Base Reactions', 'model' => 'synthetic.sdb', 'truncated' => false, 'columns' => ['OutputCase', 'StepType', 'StepNum', 'GlobalFX', 'GlobalFY', 'GlobalFZ'], 'rows' => [['DEAD', '', '', '0', '0', '800'], ['LIVE', '', '', '0', '0', '400'], ['RSX', 'Max', '', '-80', '4', '0'], ['RSY', 'Max', '', '3', '-75', '0'], ['ULS', 'Max', '', '100', '100', '1000']]],
            ['table_key' => 'Load Case Definitions - Summary', 'model' => 'synthetic.sdb', 'truncated' => false, 'columns' => ['LoadCase', 'Type', 'LoadPat', 'SF'], 'rows' => [['DEAD', 'LinStatic', 'DEAD', '1'], ['LIVE', 'LinStatic', 'LIVE', '1'], ['RSX', 'LinRespSpec', '', ''], ['RSY', 'LinRespSpec', '', ''], ['ULS', 'Combination', '', '']]],
        ];
    }

    public static function mapping(array $preview): array
    {
        return array_map(function ($m) {
            $m['units'] = $m['role'] === 'mass' ? 'kg' : ($m['role'] === 'reactions' ? 'kN' : '');

            return $m;
        }, $preview['sheets']);
    }

    public static function xlsx(string $path): void
    {
        $z = new ZipArchive;
        $z->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $workbook = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
        $rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
        foreach (self::tables() as $i => $table) {
            $n = $i + 1;
            $workbook .= '<sheet name="'.$table['table_key'].'" sheetId="'.$n.'" r:id="rId'.$n.'"/>';
            $rels .= '<Relationship Id="rId'.$n.'" Target="worksheets/sheet'.$n.'.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>';
            $rows = [['SAP2000 export · synthetic'], [], $table['columns']];
            $rows[] = match ($i) {
                0 => ['Text', 'Text', 'Unitless', 'Yes/No', 'Yes/No', 'Yes/No'],1 => ['Text', 'kg', 'kg'],2 => ['Text', 'Text', 'Unitless', 'kN', 'kN', 'kN'],3 => ['Text', 'Text', 'Text', 'Unitless']
            };
            $rows = array_merge($rows, $table['rows']);
            if ($i === 0) {
                foreach ([5, 6] as $ri) {
                    foreach ([0, 3, 4, 5] as $ci) {
                        $rows[$ri][$ci] = '';
                    }
                }
            }
            $xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
            foreach ($rows as $ri => $cells) {
                $row = $ri + 1;
                $xml .= '<row r="'.$row.'">';
                foreach ($cells as $ci => $v) {
                    $cell = chr(65 + $ci).$row;
                    $xml .= '<c r="'.$cell.'" t="inlineStr"><is><t>'.htmlspecialchars($v, ENT_XML1).'</t></is></c>';
                }$xml .= '</row>';
            }
            $xml .= '</sheetData><mergeCells><mergeCell ref="A1:F1"/>'.($i === 0 ? '<mergeCell ref="A5:A7"/><mergeCell ref="D5:D7"/><mergeCell ref="E5:E7"/><mergeCell ref="F5:F7"/>' : '').'</mergeCells></worksheet>';
            $z->addFromString('xl/worksheets/sheet'.$n.'.xml', $xml);
        }
        $z->addFromString('xl/workbook.xml', $workbook.'</sheets></workbook>');
        $z->addFromString('xl/_rels/workbook.xml.rels', $rels.'</Relationships>');
        $z->addFromString('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
        $z->close();
    }

    public static function project(): array
    {
        return ['units' => 'SI', 'height' => 10, 'Ss' => .38, 'S1' => .14, 'TL' => 8, 'TL_source' => 'Synthetic TL report', 'risk' => 'II', 'hazard_source' => 'Synthetic hazard report', 'site_source' => 'Synthetic geotech report', 'site_class' => 'E'];
    }
}
