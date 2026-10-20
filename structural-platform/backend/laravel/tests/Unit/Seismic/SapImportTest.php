<?php

namespace Tests\Unit\Seismic;

use App\Services\Seismic\MassSourceService;
use App\Services\Seismic\Sap2000SeismicImportService;
use App\Services\Seismic\SapWorkbookReader;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Tests\Fixtures\Seismic\SapFixture;

class SapImportTest extends TestCase
{
    private function dto(): array
    {
        $s = new Sap2000SeismicImportService;
        $book = $s->apiSheets(SapFixture::tables());

        return $s->normalize($book, SapFixture::mapping($s->preview($book)));
    }

    private function selection(): array
    {
        return ['source' => 'MS1', 'scope_confirmed' => true, 'basis' => 'pattern_reactions', 'reaction_scope_confirmed' => true, 'pattern_rows' => ['DEAD' => 'Base Reactions:2', 'LIVE' => 'Base Reactions:3']];
    }

    public function test_xlsx_merged_title_header_units_and_api_feed_same_dto(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'sap');
        try {
            SapFixture::xlsx($path);
            $book = (new SapWorkbookReader)->read($path, 'SAP-export.xlsx');
            $s = new Sap2000SeismicImportService;
            $preview = $s->preview($book);
            $this->assertSame(3, $preview['sheets'][0]['header_row']);
            $this->assertSame(4, $preview['sheets'][0]['units_row']);
            $this->assertContains('A1:F1', $preview['sheets'][0]['merged_cells']);
            $this->assertContains('A5:A7', $preview['sheets'][0]['merged_cells']);
            $dto = $s->normalize($book, SapFixture::mapping($preview));
            $api = $this->dto();
            $this->assertSame($api['definitions'][0]['patterns'], $dto['definitions'][0]['patterns']);
            $this->assertSame($api['masses'][0]['mass_x_kg'], $dto['masses'][0]['mass_x_kg']);
            $this->assertSame($api['reactions'][2]['FX_kN'], $dto['reactions'][2]['FX_kN']);
            $this->assertSame('SAP-export.xlsx', $dto['reactions'][0]['provenance']['filename']);
            $this->assertSame(5, $dto['reactions'][0]['provenance']['row']);
            $this->assertSame('kN', $dto['reactions'][0]['provenance']['original_units']);
            $this->assertSame('A5:A7', $dto['definitions'][0]['provenance'][1]['merged_identifiers']['source']['range']);
        } finally {
            unlink($path);
        }
    }

    public function test_multiple_patterns_weight_and_exclusions(): void
    {
        $r = (new MassSourceService)->calculate($this->dto(), $this->selection());
        $this->assertEquals(900, $r['W_kN']);
        $this->assertContains('ULS', $r['excluded_cases']);
        $this->assertNotContains('DEAD', $r['excluded_cases']);
        $this->assertSame(['DEAD' => 1.0, 'LIVE' => .25, 'ROOF' => 0.0], $r['definition']['patterns']);
    }

    public function test_definition_alone_never_implies_w(): void
    {
        $dto = $this->dto();
        $sel = ['source' => 'MS1', 'scope_confirmed' => true];
        $r = (new MassSourceService)->calculate($dto, $sel);
        $this->assertNull($r['W_kN']);
        $this->assertSame('INPUT_REQUIRED', $r['status']);
    }

    public function test_verified_total_model_mass_is_not_multiplied_by_load_factors_again(): void
    {
        $r = (new MassSourceService)->calculate($this->dto(), ['source' => 'MS1', 'scope_confirmed' => true, 'basis' => 'model_mass', 'mass_row_id' => 'Mass Summary by Group:2', 'net_model_mass_confirmed' => true]);
        $this->assertEqualsWithDelta(980.665, $r['W_kN'], 1e-8);
    }

    public function test_element_masses_block_reaction_only_derivation(): void
    {
        $d = $this->dto();
        $d['definitions'][0]['flags']['element_mass'] = true;
        $this->expectException(InvalidArgumentException::class);
        (new MassSourceService)->calculate($d, $this->selection());
    }

    public function test_unequal_directional_mass_requires_reconciliation(): void
    {
        $d = $this->dto();
        $d['masses'][0]['mass_y_kg'] = 90000;
        $this->expectException(InvalidArgumentException::class);
        (new MassSourceService)->calculate($d, ['source' => 'MS1', 'scope_confirmed' => true, 'basis' => 'model_mass', 'mass_row_id' => 'Mass Summary by Group:2', 'net_model_mass_confirmed' => true]);
    }

    public function test_same_reaction_cannot_be_reused_for_two_patterns(): void
    {
        $sel = $this->selection();
        $sel['pattern_rows']['LIVE'] = $sel['pattern_rows']['DEAD'];
        $this->expectException(InvalidArgumentException::class);
        (new MassSourceService)->calculate($this->dto(), $sel);
    }

    public function test_vertical_sign_is_not_guessed_from_absolute_value(): void
    {
        $d = $this->dto();
        $d['reactions'][0]['FZ_kN'] = -800;
        $this->expectException(InvalidArgumentException::class);
        (new MassSourceService)->calculate($d, $this->selection());
    }

    public function test_units_conversion_signed_axes_and_api_model_guard(): void
    {
        $service = new Sap2000SeismicImportService;
        $book = $service->apiSheets(SapFixture::tables());
        $map = SapFixture::mapping($service->preview($book));
        $map[2]['units'] = 'kip';
        $d = $service->normalize($book, $map);
        $this->assertEqualsWithDelta(-80 * 4.4482216152605, $d['reactions'][2]['FX_kN'], 1e-9);
        $this->assertSame('synthetic.sdb', $d['reactions'][2]['provenance']['model']);
        $tables = SapFixture::tables();
        $tables[1]['model'] = 'other.sdb';
        $this->expectException(InvalidArgumentException::class);
        $service->apiSheets($tables);
    }

    public function test_unknown_units_are_rejected_not_coerced(): void
    {
        $s = new Sap2000SeismicImportService;
        $book = $s->apiSheets(SapFixture::tables());
        $map = SapFixture::mapping($s->preview($book));
        $map[2]['units'] = 'guess';
        $this->expectException(InvalidArgumentException::class);
        $s->normalize($book, $map);
    }

    public function test_truncated_tables_are_rejected(): void
    {
        $t = SapFixture::tables();
        $t[0]['truncated'] = true;
        $this->expectException(InvalidArgumentException::class);
        (new Sap2000SeismicImportService)->apiSheets($t);
    }

    public function test_xml_entity_archive_rejected(): void
    {
        $p = tempnam(sys_get_temp_dir(), 'sap');
        try {
            $z = new \ZipArchive;
            $z->open($p, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
            $z->addFromString('xl/_rels/workbook.xml.rels', '<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>');
            $z->close();
            $this->expectException(InvalidArgumentException::class);
            (new SapWorkbookReader)->read($p, 'bad.xlsx');
        } finally {
            unlink($p);
        }
    }
}
