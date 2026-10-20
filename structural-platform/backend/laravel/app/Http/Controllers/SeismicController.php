<?php

namespace App\Http\Controllers;

use App\Services\Seismic\Rules;
use App\Services\Seismic\Sap2000SeismicImportService;
use App\Services\Seismic\SapWorkbookReader;
use App\Services\Seismic\SeismicCalculationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SeismicController extends Controller
{
    private function guarded(callable $fn)
    {
        try {
            return response()->json(['data' => $fn()]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => 'SEISMIC_INPUT_INVALID'], 422);
        }
    }

    private function owned(Request $r, int $id): object
    {
        return DB::table('seismic_imports')->where('user_id', $r->user()->id)->where('id', $id)->firstOrFail();
    }

    public function coefficients()
    {
        return response()->json(['data' => Rules::tables()]);
    }

    public function preview(Request $r)
    {
        $r->validate(['file' => 'nullable|file|mimes:xlsx|max:10240', 'tables' => 'nullable|array|min:1|max:20', 'tables.*' => 'array']);

        return $this->guarded(function () use ($r) {
            Rules::require($r->hasFile('file') xor $r->has('tables'), 'Provide either an XLSX file or API tables');
            $service = new Sap2000SeismicImportService;
            $book = $r->hasFile('file') ? (new SapWorkbookReader)->read($r->file('file')->getRealPath(), $r->file('file')->getClientOriginalName()) : $service->apiSheets($r->input('tables'));
            Rules::require(strlen(json_encode($book)) <= 15_000_000, 'Import exceeds normalized-size limit');
            $preview = $service->preview($book);
            $id = DB::table('seismic_imports')->insertGetId(['user_id' => $r->user()->id, 'book' => json_encode($book, JSON_THROW_ON_ERROR), 'created_at' => now(), 'updated_at' => now()]);

            return ['import_id' => $id, 'provenance' => array_diff_key($book, ['sheets' => true]), 'preview' => $preview];
        });
    }

    public function confirm(Request $r, int $id)
    {
        $r->validate(['mappings' => 'required|array|min:1|max:50', 'mappings.*' => 'required|array', 'mappings.*.name' => 'required|string|max:200', 'mappings.*.role' => 'required|in:ignore,definition,mass,reactions,cases', 'mappings.*.columns' => 'required_unless:mappings.*.role,ignore|array', 'mappings.*.columns.*' => 'nullable|integer|min:0|max:99', 'mappings.*.header_row' => 'nullable|integer|min:1|max:100000', 'mappings.*.units_row' => 'nullable|integer|min:1|max:100000', 'mappings.*.units' => 'nullable|string|max:30', 'mappings.*.element_mass' => 'sometimes|boolean', 'mappings.*.additional_mass' => 'sometimes|boolean', 'mappings.*.from_loads' => 'sometimes|boolean']);
        $record = $this->owned($r, $id);

        return $this->guarded(function () use ($r, $record) {
            Rules::require($record->normalized === null, 'Confirmed imports are immutable; upload/read again to remap');
            $dto = (new Sap2000SeismicImportService)->normalize(json_decode($record->book, true), $r->input('mappings'));
            DB::table('seismic_imports')->where('id', $record->id)->whereNull('normalized')->update(['normalized' => json_encode($dto, JSON_THROW_ON_ERROR), 'updated_at' => now()]);

            return ['import_id' => $record->id, 'dto' => $dto];
        });
    }

    public function calculate(Request $r)
    {
        $r->validate([
            'input' => 'required|array', 'import_id' => 'nullable|integer',
            'input.project' => 'required|array', 'input.project.layers' => 'sometimes|array|max:200',
            'input.project.layers.*' => 'array', 'input.directions' => 'required|array',
            'input.directions.X' => 'required|array', 'input.directions.Y' => 'required|array',
            'input.mass' => 'sometimes|array', 'input.mass.pattern_rows' => 'sometimes|array|max:2000',
            'input.rs' => 'sometimes|array', 'input.rs.X' => 'sometimes|array', 'input.rs.Y' => 'sometimes|array',
        ]);
        foreach (['project' => ['name', 'region', 'hazard_source', 'site_source', 'TL_source', 'coefficient_source', 'coefficient_reason', 'Ie_reason'], 'mass' => ['source', 'basis', 'mass_row_id']] as $group => $fields) {
            foreach ($fields as $field) {
                $r->validate(["input.$group.$field" => 'sometimes|nullable|string|max:2000']);
            }
        }
        foreach (['scope_confirmed', 'net_model_mass_confirmed', 'mass_source_association_confirmed', 'reaction_scope_confirmed'] as $flag) {
            $r->validate(["input.mass.$flag" => 'sometimes|boolean']);
        }
        foreach (['site_f', 'soft_clay_e', 'site_specific', 'profile_screened', 'rock_confirmed'] as $flag) {
            $r->validate(["input.project.$flag" => 'sometimes|boolean']);
        }
        foreach (['X', 'Y'] as $axis) {
            foreach (['global_axes', 'modal_combination_confirmed', 'applicability_confirmed'] as $flag) {
                $r->validate(["input.rs.$axis.$flag" => 'sometimes|boolean']);
            }
            $r->validate(["input.directions.$axis.moment_eligible" => 'sometimes|boolean']);
            foreach (['case', 'row_id', 'case_type', 'result_state', 'scale_source'] as $field) {
                $r->validate(["input.rs.$axis.$field" => 'sometimes|nullable|string|max:2000']);
            }
        }
        $record = $r->input('import_id') ? $this->owned($r, (int) $r->input('import_id')) : null;

        return $this->guarded(function () use ($r, $record) {
            Rules::require(! $record || $record->normalized !== null, 'Confirm the import mapping before calculation');
            $result = (new SeismicCalculationService)->calculate($r->input('input'), $record ? json_decode($record->normalized, true) : null);
            $result['source_snapshot'] = $record ? json_decode($record->normalized, true) : null;
            $id = DB::table('seismic_runs')->insertGetId(['user_id' => $r->user()->id, 'seismic_import_id' => $record?->id, 'snapshot' => json_encode($result, JSON_THROW_ON_ERROR), 'created_at' => now()]);

            return ['run_id' => $id, 'result' => $result];
        });
    }

    public function run(Request $r, int $id)
    {
        $record = DB::table('seismic_runs')->where('user_id', $r->user()->id)->where('id', $id)->firstOrFail();

        return response()->json(['data' => ['run_id' => $id, 'result' => json_decode($record->snapshot, true)]]);
    }
}
