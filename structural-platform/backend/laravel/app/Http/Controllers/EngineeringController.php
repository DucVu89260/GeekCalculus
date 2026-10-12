<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class EngineeringController extends Controller
{
    private const FIELDS = ['project_type' => 'project_types', 'standard' => 'standards', 'material' => 'materials', 'unit' => 'units', 'module' => 'modules'];

    private function locale(Request $request): string
    {
        return $request->validate(['locale' => ['sometimes', Rule::in(['vi', 'en'])]])['locale'] ?? 'vi';
    }

    public function health(): JsonResponse
    {
        DB::table('locales')->count();

        return response()->json(['status' => 'ok', 'database' => 'connected']);
    }

    public function catalog(Request $request): JsonResponse
    {
        $locale = $this->locale($request);
        $result = ['locale' => $locale, 'locales' => DB::table('locales')->get(['code', 'name'])];
        foreach (array_values(self::FIELDS) as $kind) {
            $result[$kind] = DB::table('catalog_options as o')
                ->join('catalog_option_translations as t', 't.option_code', '=', 'o.code')
                ->where('o.kind', $kind)->where('t.locale', $locale)->orderBy('o.sort_order')
                ->get(['o.code', 't.name']);
        }

        return response()->json($result);
    }

    private function present(object $project, string $locale): array
    {
        $row = (array) $project;
        $labels = DB::table('catalog_option_translations')->where('locale', $locale)
            ->whereIn('option_code', array_map(fn ($field) => $row[$field], array_keys(self::FIELDS)))
            ->pluck('name', 'option_code');
        foreach (array_keys(self::FIELDS) as $field) {
            $row[$field.'_name'] = $labels[$row[$field]] ?? $row[$field];
        }
        $row['status_name'] = $locale === 'vi' ? 'Bản nháp' : 'Draft';

        return $row;
    }

    public function index(Request $request): JsonResponse
    {
        $locale = $this->locale($request);
        $query = DB::table('projects');
        if ($request->user()->role !== 'admin') {
            $query->where('user_id', $request->user()->id);
        }
        $rows = $query->orderByDesc('id')->paginate(50);

        return response()->json([
            'data' => $rows->getCollection()->map(fn ($row) => $this->present($row, $locale)),
            'meta' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $locale = $this->locale($request);
        $rules = ['name' => ['required', 'string', 'max:160', 'regex:/\\S/u']];
        foreach (self::FIELDS as $field => $kind) {
            $rules[$field] = ['required', 'string', Rule::exists('catalog_options', 'code')->where('kind', $kind)];
        }
        $data = $request->validate($rules);
        $data['name'] = trim($data['name']);
        $id = DB::table('projects')->insertGetId($data + ['user_id' => $request->user()->id, 'status' => 'draft', 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['data' => $this->present(DB::table('projects')->find($id), $locale)], 201);
    }
}
