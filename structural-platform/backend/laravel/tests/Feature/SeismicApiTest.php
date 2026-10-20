<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Fixtures\Seismic\SapFixture;
use Tests\TestCase;

class SeismicApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_calculation_or_import(): void
    {
        $this->getJson('/api/v1/seismic/coefficients')->assertUnauthorized();
        $this->postJson('/api/v1/seismic/calculate', [])->assertUnauthorized();
        $this->postJson('/api/v1/seismic/imports/preview', [])->assertUnauthorized();
    }

    public function test_native_preview_confirm_calculate_and_immutable_owned_run(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->actingAs($a);
        $preview = $this->postJson('/api/v1/seismic/imports/preview', ['tables' => SapFixture::tables()])->assertOk()->json('data');
        $id = $preview['import_id'];
        $map = SapFixture::mapping($preview['preview']);
        $this->postJson("/api/v1/seismic/imports/$id/confirm", ['mappings' => $map])->assertOk()->assertJsonPath('data.dto.schema_version', 'sap-seismic/1');
        $this->postJson("/api/v1/seismic/imports/$id/confirm", ['mappings' => $map])->assertUnprocessable();
        $input = ['project' => SapFixture::project(), 'directions' => ['X' => ['system' => 'B2', 'Tmodal' => .2], 'Y' => ['system' => 'C1', 'Tmodal' => .3]], 'mass' => ['source' => 'MS1', 'basis' => 'pattern_reactions', 'scope_confirmed' => true, 'reaction_scope_confirmed' => true, 'pattern_rows' => ['DEAD' => 'Base Reactions:2', 'LIVE' => 'Base Reactions:3']]];
        $run = $this->postJson('/api/v1/seismic/calculate', ['import_id' => $id, 'input' => $input])->assertOk()->assertJsonPath('data.result.mass.W_kN', 900)->json('data');
        $rid = $run['run_id'];
        $this->getJson("/api/v1/seismic/runs/$rid")->assertOk()->assertJsonPath('data.result.source_snapshot.origin', 'api');
        $this->actingAs($b);
        $this->getJson("/api/v1/seismic/runs/$rid")->assertNotFound();
        $this->postJson('/api/v1/seismic/calculate', ['import_id' => $id, 'input' => $input])->assertNotFound();
        $this->postJson("/api/v1/seismic/imports/$id/confirm", ['mappings' => $map])->assertNotFound();
    }

    public function test_calculate_without_import_has_no_weight_or_synthetic_v(): void
    {
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/v1/seismic/calculate', ['input' => ['project' => SapFixture::project(), 'directions' => ['X' => ['system' => 'B2'], 'Y' => ['system' => 'C1']]]])->assertOk()->assertJsonPath('data.result.mass', null)->assertJsonPath('data.result.directions.X.elf.V_kN', null);
    }

    public function test_invalid_inputs_do_not_write_run(): void
    {
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/v1/seismic/calculate', ['input' => ['project' => ['units' => 'bad'], 'directions' => ['X' => ['system' => 'B2'], 'Y' => ['system' => 'C1']]]])->assertUnprocessable()->assertJsonPath('code', 'SEISMIC_INPUT_INVALID');
        $this->assertDatabaseCount('seismic_runs', 0);
    }

    public function test_real_xlsx_upload_preview_then_import(): void
    {
        $this->actingAs(User::factory()->create());
        $p = tempnam(sys_get_temp_dir(), 'sap');
        try {
            SapFixture::xlsx($p);
            $file = new UploadedFile($p, 'sap.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
            $res = $this->post('/api/v1/seismic/imports/preview', ['file' => $file], ['Accept' => 'application/json'])->assertOk()->json('data');
            $this->postJson('/api/v1/seismic/imports/'.$res['import_id'].'/confirm', ['mappings' => SapFixture::mapping($res['preview'])])->assertOk()->assertJsonCount(5, 'data.dto.reactions');
        } finally {
            if (file_exists($p)) {
                unlink($p);
            }
        }
    }

    public function test_rs_requires_imported_case_type_and_blocks_combination_or_single_mode(): void
    {
        $this->actingAs(User::factory()->create());
        $preview = $this->postJson('/api/v1/seismic/imports/preview', ['tables' => SapFixture::tables()])->assertOk()->json('data');
        $id = $preview['import_id'];
        $this->postJson("/api/v1/seismic/imports/$id/confirm", ['mappings' => SapFixture::mapping($preview['preview'])])->assertOk();
        $selection = ['case' => 'RSX', 'row_id' => 'Base Reactions:4', 'case_type' => 'response_spectrum', 'global_axes' => true, 'modal_combination_confirmed' => true, 'applicability_confirmed' => true, 'result_state' => 'raw', 'scale_source' => 'Synthetic spectrum reference'];
        $input = ['project' => SapFixture::project(), 'directions' => ['X' => ['system' => 'B2'], 'Y' => ['system' => 'C1']], 'mass' => ['source' => 'MS1', 'scope_confirmed' => true, 'basis' => 'model_mass', 'mass_row_id' => 'Mass Summary by Group:2', 'net_model_mass_confirmed' => true], 'rs' => ['X' => $selection]];
        $this->postJson('/api/v1/seismic/calculate', ['import_id' => $id, 'input' => $input])->assertOk()->assertJsonPath('data.result.directions.X.rs.signed_kN', -80)->assertJsonPath('data.result.standard_source.edition', 'ASCE 7-10');
        $input['rs']['X']['case'] = 'ULS';
        $input['rs']['X']['row_id'] = 'Base Reactions:6';
        $this->postJson('/api/v1/seismic/calculate', ['import_id' => $id, 'input' => $input])->assertUnprocessable()->assertJsonPath('code', 'SEISMIC_INPUT_INVALID');
        $this->assertDatabaseCount('seismic_runs', 1);
    }

    public function test_bad_api_table_dimensions_have_clear_validation_and_no_import(): void
    {
        $this->actingAs(User::factory()->create());
        $t = SapFixture::tables();
        $t[0]['rows'][0] = ['broken'];
        $this->postJson('/api/v1/seismic/imports/preview', ['tables' => $t])->assertUnprocessable()->assertJsonPath('code', 'SEISMIC_INPUT_INVALID');
        $this->assertDatabaseCount('seismic_imports', 0);
    }

    public function test_unrelated_sheet_can_be_ignored_without_header_or_units(): void
    {
        $this->actingAs(User::factory()->create());
        $tables = SapFixture::tables();
        $tables[] = ['table_key' => 'Unrelated notes', 'model' => 'synthetic.sdb', 'truncated' => false, 'columns' => ['Note'], 'rows' => [['Synthetic export metadata']]];
        $preview = $this->postJson('/api/v1/seismic/imports/preview', ['tables' => $tables])->assertOk()->json('data');
        $maps = SapFixture::mapping($preview['preview']);
        $maps[4] = ['name' => 'Unrelated notes', 'role' => 'ignore'];
        $this->postJson('/api/v1/seismic/imports/'.$preview['import_id'].'/confirm', ['mappings' => $maps])->assertOk()->assertJsonCount(1, 'data.dto.definitions');
    }
}
