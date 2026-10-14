<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ComboGeneratorWorkspaceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $raw = DB::table('combo_generator_workspaces')
            ->where('user_id', $request->user()->id)
            ->value('payload');

        return response()->json(['data' => $raw ? json_decode($raw, true) : null]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payload' => ['required', 'array'],
            'payload.loadCases' => ['required', 'array', 'min:1', 'max:500'],
            'payload.combinations' => ['required', 'array', 'max:25000'],
            'payload.comboTemplates' => ['sometimes', 'array', 'max:200'],
            'payload.seismicParameters' => ['sometimes', 'array', 'max:30'],
        ]);
        $payload = $validated['payload'];
        $patternNames = [];

        foreach ($payload['loadCases'] as $item) {
            if (!is_array($item) || !isset($item['name']) || !is_string($item['name'])
                || trim($item['name']) === '' || mb_strlen($item['name']) > 200) {
                throw ValidationException::withMessages(['payload.loadCases' => 'Invalid Load Pattern name.']);
            }
            if (isset($patternNames[$item['name']])) {
                throw ValidationException::withMessages(['payload.loadCases' => 'Duplicate Load Pattern name.']);
            }
            $patternNames[$item['name']] = true;
        }
        foreach ($payload['combinations'] as $combo) {
            if (!is_array($combo) || !isset($combo['name']) || !is_string($combo['name'])
                || mb_strlen($combo['name']) > 1500 || !isset($combo['terms'])
                || !is_array($combo['terms']) || count($combo['terms']) > 500) {
                throw ValidationException::withMessages(['payload.combinations' => 'Invalid Load Combination.']);
            }
            foreach ($combo['terms'] as $term) {
                if (!is_array($term) || !isset($term['loadCaseName'], $term['factor'])
                    || !is_string($term['loadCaseName'])
                    || !isset($patternNames[$term['loadCaseName']])
                    || !is_numeric($term['factor']) || !is_finite((float) $term['factor'])) {
                    throw ValidationException::withMessages(['payload.combinations' => 'Invalid combination term or missing Load Pattern.']);
                }
            }
        }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($json) > 12_000_000) {
            throw ValidationException::withMessages(['payload' => 'Workspace exceeds 12 MB limit.']);
        }

        $now = now();
        DB::table('combo_generator_workspaces')->updateOrInsert(
            ['user_id' => $request->user()->id],
            ['payload' => $json, 'updated_at' => $now]
        );

        return response()->json(['message' => 'Combo Generator workspace saved.', 'data' => ['combinations' => count($payload['combinations'])]]);
    }
}
