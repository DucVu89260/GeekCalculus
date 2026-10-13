<?php

namespace App\Http\Controllers;

use App\Models\Material;
use App\Models\Section;
use App\Models\SectionType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class LibraryTransferController extends Controller
{
    private const MODELS = ['materials' => Material::class, 'section_types' => SectionType::class, 'sections' => Section::class];

    public function export()
    {
        // One snapshot, with stable codes instead of machine-specific database IDs.
        $archive = DB::transaction(function () {
            $materials = Material::orderBy('code')->get();
            $types = SectionType::orderBy('code')->get();
            $materialCodes = $materials->pluck('code', 'id');
            $typeCodes = $types->pluck('code', 'id');

            return [
                'format' => 'geekcalculus-engineering-library',
                'version' => 1,
                'exported_at' => now()->toIso8601String(),
                'materials' => $materials->map(fn ($row) => $row->only(['code', 'name_vi', 'name_en', 'category', 'source', 'properties']))->all(),
                'section_types' => $types->map(fn ($row) => $row->only(['code', 'name_vi', 'name_en', 'category', 'shape']))->all(),
                'sections' => Section::orderBy('code')->get()->map(fn ($row) => $row->only(['code', 'name_vi', 'name_en', 'source', 'properties']) + ['material_code' => $materialCodes[$row->material_id], 'section_type_code' => $typeCodes[$row->section_type_id]])->all(),
            ];
        });

        return response()->json(['data' => $archive])->header('Cache-Control', 'no-store');
    }

    public function import(Request $request, LibraryController $library)
    {
        abort_if(strlen($request->getContent()) > 10 * 1024 * 1024, 413, 'Library file exceeds 10 MB.');
        $rules = [
            'mode' => 'required|in:skip,overwrite',
            'archive' => 'required|array:format,version,exported_at,materials,section_types,sections',
            'archive.format' => 'required|in:geekcalculus-engineering-library',
            'archive.version' => 'required|integer|in:1',
            'archive.exported_at' => 'sometimes|date',
        ];
        foreach (self::MODELS as $resource => $model) {
            $keys = $resource === 'section_types' ? 'category,shape' : ($resource === 'materials' ? 'category,source,properties' : 'material_code,section_type_code,source,properties');
            $rules['archive.'.$resource] = 'present|array|list|max:20000';
            $rules['archive.'.$resource.'.*'] = 'required|array:code,name_vi,name_en,'.$keys;
            $rules['archive.'.$resource.'.*.code'] = ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/', 'distinct:strict'];
            foreach (['name_vi', 'name_en'] as $name) {
                $rules['archive.'.$resource.'.*.'.$name] = 'required|string|max:255|regex:/\S/u';
            }
        }
        foreach (['material_code', 'section_type_code'] as $key) {
            $rules['archive.sections.*.'.$key] = 'required|string|max:64';
        }
        $input = $request->validate($rules);
        $archive = $input['archive'];
        $materialCodes = array_column($archive['materials'], 'code');
        $typeCodes = array_column($archive['section_types'], 'code');
        foreach ($archive['sections'] as $index => $section) {
            foreach (['material_code' => $materialCodes, 'section_type_code' => $typeCodes] as $key => $codes) {
                if (! in_array($section[$key], $codes, true)) {
                    throw ValidationException::withMessages(['archive.sections.'.$index.'.'.$key => ['Referenced code must be included in the archive.']]);
                }
            }
        }

        // A bad record or reference rolls back the whole library, including dropdown labels.
        $counts = DB::transaction(function () use ($archive, $input, $library) {
            $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];
            foreach (self::MODELS as $resource => $model) {
                foreach ($archive[$resource] as $index => $data) {
                    $row = $model::where('code', $data['code'])->first();
                    if ($row && $input['mode'] === 'skip') {
                        $counts['skipped']++;

                        continue;
                    }
                    if ($resource === 'sections') {
                        $data['material_id'] = Material::where('code', $data['material_code'])->value('id');
                        $data['section_type_id'] = SectionType::where('code', $data['section_type_code'])->value('id');
                        unset($data['material_code'], $data['section_type_code']);
                    }
                    try {
                        $library->persist(str_replace('_', '-', $resource), $row ?? new $model, $data);
                    } catch (ValidationException $exception) {
                        $errors = [];
                        foreach ($exception->errors() as $key => $messages) {
                            $errors['archive.'.$resource.'.'.$index.'.'.$key] = $messages;
                        }
                        throw ValidationException::withMessages($errors);
                    } catch (HttpException $exception) {
                        abort($exception->getStatusCode(), $resource.' / '.$data['code'].': '.$exception->getMessage());
                    }
                    $counts[$row ? 'updated' : 'created']++;
                }
            }

            return $counts;
        });

        return response()->json(['data' => $counts]);
    }
}
