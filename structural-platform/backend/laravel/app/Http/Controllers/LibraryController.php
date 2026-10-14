<?php

namespace App\Http\Controllers;

use App\Models\Material;
use App\Models\Section;
use App\Models\SectionType;
use App\Services\SectionPropertyCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LibraryController extends Controller
{
    private const MODELS = ['materials' => Material::class, 'section-types' => SectionType::class, 'sections' => Section::class];

    private function definitions(): array
    {
        $schema = json_decode(file_get_contents(base_path('../../database/seeds/engineering-schema.json')), true, 512, JSON_THROW_ON_ERROR);
        $schema['section_properties_registry'] = json_decode(file_get_contents(base_path('../../section-properties/section-registry.json')), true, 512, JSON_THROW_ON_ERROR);

        return $schema;
    }

    public function schema()
    {
        return response()->json($this->definitions());
    }

    private function model(Request $r)
    {
        return self::MODELS[$r->route('resource')];
    }

    private function present($row): array
    {
        $data = $row->toArray();
        if ($row instanceof Material) {
            $data['computed'] = ['shear_modulus' => $row->properties['elastic_modulus'] / (2 * (1 + $row->properties['poisson_ratio']))];
        }
        if ($row instanceof Section) {
            if ($row->section_properties) {
                $data['computed'] = ['rx' => data_get($row->section_properties, 'properties.elastic.rx'), 'ry' => data_get($row->section_properties, 'properties.elastic.ry')];
            } elseif (isset($row->properties['inertia_y'], $row->properties['inertia_z'], $row->properties['area']) && $row->properties['area'] > 0) {
                // Untouched legacy catalogs retain their source axes; do not silently relabel them XY.
                $data['computed'] = ['radius_y' => sqrt($row->properties['inertia_y'] / $row->properties['area']), 'radius_z' => sqrt($row->properties['inertia_z'] / $row->properties['area'])];
            }
        }

        return $data;
    }

    public function index(Request $r)
    {
        $model = $this->model($r);

        return response()->json(['data' => $model::orderBy('id')->get()->map(fn ($row) => $this->present($row))]);
    }

    public function store(Request $r)
    {
        $model = $this->model($r);

        return $this->save($r, new $model);
    }

    public function update(Request $r)
    {
        $model = $this->model($r);

        return $this->save($r, $model::findOrFail($r->route('id')));
    }

    private function save(Request $r, $row)
    {
        $row = $this->persist($r->route('resource'), $row, $r->all());

        return response()->json(['data' => $this->present($row)], $row->wasRecentlyCreated ? 201 : 200);
    }

    public function persist(string $resource, $row, array $input)
    {
        $schema = $this->definitions();
        $rules = ['code' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique($row->getTable())->ignore($row->id)], 'name_vi' => 'required|string|max:255|regex:/\S/u', 'name_en' => 'required|string|max:255|regex:/\S/u'];
        $category = $input['category'] ?? null;
        $shape = null;
        if ($resource === 'sections') {
            $rules += ['section_type_id' => 'required|integer|exists:section_types,id', 'material_id' => 'required|integer|exists:materials,id'];
            Validator::make($input, $rules)->validate();
            $type = SectionType::findOrFail($input['section_type_id']);
            $material = Material::findOrFail($input['material_id']);
            $category = $type->category;
            $shape = $type->shape;
            if ($material->category !== ($category === 'rc' ? 'concrete' : 'steel')) {
                throw ValidationException::withMessages(['material_id' => ['Material category does not match section type.']]);
            }
        } else {
            $rules['category'] = ['required', Rule::in(array_column($schema['categories'][$resource === 'section-types' ? 'section_types' : 'materials'], 'code'))];
            // Optional for old archives/clients: omission preserves existing metadata.
            $rules['design_code'] = ['sometimes', 'nullable', 'string', Rule::in(array_column($schema['design_codes'], 'code'))];
        }
        if ($resource === 'section-types') {
            $rules['shape'] = ['required', Rule::in(array_column(array_filter($schema['shapes'], fn ($s) => $s['category'] === $category), 'code'))];
            $rules['region_type'] = 'sometimes|nullable|string|max:64|regex:/\S/u';
        } else {
            $rules['source'] = 'nullable|string|max:2000';
            $fields = array_filter($schema['fields'][$resource], fn ($f) => (! isset($f['categories']) || in_array($category, $f['categories'])) && (! isset($f['shapes']) || in_array($shape, $f['shapes'])));
            if ($resource === 'sections') {
                // Older clients and archives may send manual constants. Only geometry is authoritative.
                foreach ($schema['fields']['sections'] as $field) {
                    if ($field['read_only'] ?? false) {
                        if (is_array($input['properties'] ?? null)) {
                            unset($input['properties'][$field['key']]);
                        }
                    }
                }
                $fields = array_filter($fields, fn ($f) => ! ($f['read_only'] ?? false));
            }
            $asymmetric = $resource === 'sections' && $shape === 'i'
                && count(array_intersect(['top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness'], array_keys(is_array($input['properties'] ?? null) ? $input['properties'] : []))) > 0;
            $rules['properties'] = ['required', 'array:'.implode(',', array_column($fields, 'key'))];
            foreach ($fields as $f) {
                $required = $f['required'];
                if ($asymmetric && in_array($f['key'], ['width', 'flange_thickness'])) {
                    $required = false;
                }
                if ($asymmetric && in_array($f['key'], ['top_flange_width', 'bottom_flange_width', 'top_flange_thickness', 'bottom_flange_thickness'])) {
                    $required = true;
                }
                $rules['properties.'.$f['key']] = [$required ? 'required' : 'sometimes', 'numeric', 'min:'.$f['min'], 'max:'.($f['max'] ?? 1e24)];
            }
        }
        $data = Validator::make($input, $rules)->validate();
        if (isset($data['properties'])) {
            $data['properties'] = array_map('floatval', $data['properties']);
        }
        if ($resource === 'materials') {
            $p = $data['properties'];
            if (isset($p['yield_strength']) && $p['ultimate_strength'] < $p['yield_strength']) {
                throw ValidationException::withMessages(['properties.ultimate_strength' => ['Ultimate strength must be at least yield strength.']]);
            }
            foreach (['compressive', 'tensile'] as $strength) {
                if (isset($p['design_'.$strength.'_strength']) && $p['design_'.$strength.'_strength'] > $p[$strength.'_strength']) {
                    throw ValidationException::withMessages(['properties.design_'.$strength.'_strength' => ['Design strength cannot exceed reference strength.']]);
                }
            }
        }
        if ($resource === 'sections') {
            $this->validateGeometry($data['properties'], $shape);
            if ($shape === 'i' && isset($data['properties']['top_flange_width'])) {
                // Store one unambiguous set of dimensions in asymmetric mode.
                unset($data['properties']['width'], $data['properties']['flange_thickness']);
            }
            $data['section_properties'] = app(SectionPropertyCalculator::class)->calculate($shape, $data['properties']);
            $data['section_properties_calculated_at'] = now();
        }

        return DB::transaction(function () use ($resource, $row, $data, $shape, $category) {
            if ($resource === 'sections') {
                // The engine call precedes the write; recheck references under the transaction.
                $currentType = SectionType::whereKey($data['section_type_id'])->lockForUpdate()->first();
                $currentMaterial = Material::whereKey($data['material_id'])->lockForUpdate()->first();
                abort_if(! $currentType || ! $currentMaterial || $currentType->shape !== $shape || $currentType->category !== $category
                    || $currentMaterial->category !== ($category === 'rc' ? 'concrete' : 'steel'), 409, 'Section references changed during calculation. Please retry.');
            }
            if ($row->exists && $resource === 'materials' && $data['code'] !== $row->code) {
                abort_if(Section::where('material_id', $row->id)->exists() || DB::table('projects')->where('material', $row->code)->exists(), 409, 'A referenced material cannot change code.');
            }
            if ($resource === 'materials' && DB::table('catalog_options')->where('code', $data['code'])->where('kind', '!=', 'materials')->exists()) {
                throw ValidationException::withMessages(['code' => ['Code is used by another catalog.']]);
            }
            $oldCode = $row->code;
            if ($row->exists && $resource === 'materials' && $data['category'] !== $row->category) {
                abort_if(Section::where('material_id', $row->id)->exists(), 409, 'A referenced material cannot change category.');
            }
            if ($row->exists && $resource === 'section-types' && ($data['category'] !== $row->category || $data['shape'] !== $row->shape)) {
                abort_if(Section::where('section_type_id', $row->id)->exists(), 409, 'A referenced type cannot change shape or category.');
            }
            $row->fill($data);
            $row->save();
            if ($resource === 'materials') {
                if ($oldCode && $oldCode !== $row->code) {
                    DB::table('catalog_options')->where('code', $oldCode)->where('kind', 'materials')->delete();
                }
                DB::table('catalog_options')->updateOrInsert(['code' => $row->code], ['kind' => 'materials', 'sort_order' => 100]);
                foreach (['vi' => $row->name_vi, 'en' => $row->name_en] as $locale => $name) {
                    DB::table('catalog_option_translations')->updateOrInsert(['option_code' => $row->code, 'locale' => $locale], ['name' => $name]);
                }
            }

            return $row;
        });
    }

    private function validateGeometry(array $p, string $shape): void
    {
        $invalid = false;
        if ($shape === 'i') {
            $d = SectionPropertyCalculator::requestFor($shape, $p)['geometry']['dimensions'];
            $invalid = $d['web_thickness'] >= min($d['top_flange_width'], $d['bottom_flange_width'])
                || $d['depth'] <= $d['top_flange_thickness'] + $d['bottom_flange_thickness'];
        }
        if (in_array($shape, ['channel', 'tee'])) {
            $invalid = $p['web_thickness'] >= $p['width'] || (in_array($shape, ['i', 'channel']) ? 2 : 1) * $p['flange_thickness'] >= $p['depth'];
        }
        if (in_array($shape, ['angle', 'double_angle'])) {
            $invalid = $p['thickness'] >= min($p['depth'], $p['width']);
        }
        if ($shape === 'rectangular_hollow') {
            $invalid = 2 * $p['thickness'] >= min($p['depth'], $p['width']);
        }
        if ($shape === 'circular_hollow') {
            $invalid = 2 * $p['thickness'] >= $p['diameter'];
        }
        if ($invalid) {
            throw ValidationException::withMessages(['properties' => ['Thickness is incompatible with outer dimensions.']]);
        }
        if (isset($p['concrete_cover']) && 2 * $p['concrete_cover'] >= ($shape === 'circle' ? $p['diameter'] : min($p['depth'], $p['width']))) {
            throw ValidationException::withMessages(['properties.concrete_cover' => ['Cover must be less than half the smallest dimension.']]);
        }
    }

    public function destroy(Request $r)
    {
        $model = $this->model($r);
        $row = $model::findOrFail($r->route('id'));

        return DB::transaction(function () use ($row) {
            if ($row instanceof Material) {
                abort_if(Section::where('material_id', $row->id)->exists() || DB::table('projects')->where('material', $row->code)->exists(), 409, 'Material is referenced by a section or project.');
                DB::table('catalog_options')->where('code', $row->code)->where('kind', 'materials')->delete();
            }
            if ($row instanceof SectionType) {
                abort_if(Section::where('section_type_id', $row->id)->exists(), 409, 'Section type is referenced by a section.');
            }
            $row->delete();

            return response()->json(['data' => null]);
        });
    }
}
