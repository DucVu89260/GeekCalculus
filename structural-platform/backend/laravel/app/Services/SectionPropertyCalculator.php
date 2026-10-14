<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class SectionPropertyCalculator
{
    /** All dimensions are in mm. The result uses the package's XY axes, never implicit catalog Y/Z aliases. */
    public static function requestFor(string $shape, array $p): array
    {
        $registry = json_decode(file_get_contents(base_path('../../section-properties/section-registry.json')), true, 512, JSON_THROW_ON_ERROR);
        $profileId = $shape === 'i'
            ? (isset($p['top_flange_width']) ? 'asymmetric_i' : 'symmetric_i')
            : ($registry['aliases'][$shape] ?? $shape);
        $profile = collect($registry['profiles'])->firstWhere('id', $profileId);
        if (! $profile) {
            throw ValidationException::withMessages(['section_type_id' => ['This geometry has no section-property solver.']]);
        }
        $dimensions = [];
        foreach ($profile['engine_dimensions'] as $engineKey => $inputKey) {
            $catalogKey = $registry['dimensions'][$inputKey]['catalog_key'] ?? $inputKey;
            $dimensions[$engineKey] = $p[$catalogKey];
        }
        $type = $profile['geometry_type'];
        $variant = $profile['geometry_variant'];

        return [
            'profile_id' => $profile['id'],
            'geometry' => ['type' => $type, 'geometry_variant' => $variant, 'geometry_model_version' => '1.0.0', 'dimensions' => $dimensions],
            'units' => 'mm',
            'options' => ['include_plastic' => true, 'include_advanced' => true],
        ];
    }

    public function calculate(string $shape, array $properties): array
    {
        $payload = self::requestFor($shape, $properties);
        try {
            $response = Http::baseUrl(rtrim((string) config('sectional.engine_url'), '/'))
                ->acceptJson()
                ->timeout((float) config('sectional.timeout_seconds', 8))
                ->connectTimeout((float) config('sectional.connect_timeout_seconds', 2))
                ->post('/v1/sections/calculate', $payload);
        } catch (ConnectionException) {
            abort(503, 'Section calculation service is unavailable. No section changes were saved.');
        }
        $result = $response->json();
        if ($response->status() === 422 && is_array($result)) {
            $errors = [];
            foreach (is_array($result['errors'] ?? null) ? $result['errors'] : [] as $error) {
                if (! is_array($error)) {
                    continue;
                }
                $path = is_string($error['path'] ?? null) ? $error['path'] : '';
                $key = str_contains($path, '.dimensions.') ? substr($path, strrpos($path, '.') + 1) : null;
                $key = $key === 'height' ? 'depth' : $key;
                $errors[$key ? 'properties.'.$key : 'properties'] = [$error['message'] ?? 'The section geometry cannot be calculated.'];
            }
            throw ValidationException::withMessages($errors ?: ['properties' => [$result['message'] ?? 'The section geometry cannot be calculated.']]);
        }
        if (! $response->successful() || ! is_array($result) || ! $this->validResult($result, $payload)) {
            abort(503, 'Section calculation service returned an invalid result. No section changes were saved.');
        }

        return $result;
    }

    private function finite($value, bool $positive = false): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && (! $positive || $value > 0);
    }

    /** Refuse truncated, stale or invalid engine responses before any database write. */
    private function validResult(array $r, array $payload): bool
    {
        $registry = json_decode(file_get_contents(base_path('../../section-properties/section-registry.json')), true, 512, JSON_THROW_ON_ERROR);
        $geometry = data_get($r, 'normalized_input.geometry');
        if (($r['status'] ?? null) !== 'success' || ($r['schema_version'] ?? null) !== '1.0'
            || ($r['geometry_type'] ?? null) !== $payload['geometry']['type']
            || data_get($r, 'units.length') !== 'mm' || data_get($r, 'units.area') !== 'mm2'
            || data_get($r, 'units.second_moment') !== 'mm4' || data_get($r, 'units.section_modulus') !== 'mm3'
            || data_get($r, 'units.warping_constant') !== 'mm6'
            || data_get($r, 'units.torsion_constant') !== 'mm4' || data_get($r, 'units.shear_center') !== 'mm'
            || data_get($r, 'units.effective_shear_area') !== 'mm2' || data_get($r, 'units.angle') !== 'deg'
            || ($r['geometry_model_version'] ?? null) !== '1.0.0'
            || data_get($r, 'normalized_input.options.include_plastic') !== true
            || data_get($r, 'normalized_input.options.include_advanced') !== true
            || data_get($r, 'normalized_input.units') !== 'mm'
            || ! is_array($geometry) || ($geometry['type'] ?? null) !== $payload['geometry']['type']
            || ($geometry['geometry_variant'] ?? null) !== $payload['geometry']['geometry_variant']
            || ($geometry['geometry_model_version'] ?? null) !== '1.0.0'
            || data_get($r, 'solver.method') !== 'analytical'
            || ! is_string(data_get($r, 'solver.config_hash')) || ! preg_match('/^[a-f0-9]{64}$/', data_get($r, 'solver.config_hash'))
            || ! is_string(data_get($r, 'solver.version')) || version_compare(data_get($r, 'solver.version'), '1.3.0', '<')
            || ! is_string($r['geometry_hash'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/', $r['geometry_hash'])
            || ! is_array($r['diagnostics'] ?? null)) {
            return false;
        }
        $dimensions = $geometry['dimensions'] ?? [];
        if (! is_array($dimensions) || count($dimensions) !== count($payload['geometry']['dimensions'])) {
            return false;
        }
        foreach ($payload['geometry']['dimensions'] as $key => $value) {
            if (! $this->finite($dimensions[$key] ?? null, $key !== 'distance') || ($key === 'distance' && $dimensions[$key] < 0) || $dimensions[$key] != $value) {
                return false;
            }
        }
        foreach (['geometric.area', 'geometric.perimeter', 'elastic.ix', 'elastic.iy', 'elastic.sx_positive', 'elastic.sx_negative', 'elastic.sy_positive', 'elastic.sy_negative', 'elastic.rx', 'elastic.ry', 'plastic.zx', 'plastic.zy', 'principal.i_major', 'principal.i_minor'] as $path) {
            if (! $this->finite(data_get($r, 'properties.'.$path), true)) {
                return false;
            }
        }
        foreach (['geometric.centroid_x', 'geometric.centroid_y', 'elastic.ixy', 'plastic.pna_x', 'plastic.pna_y'] as $path) {
            if (! $this->finite(data_get($r, 'properties.'.$path))) {
                return false;
            }
        }
        if (! in_array(data_get($r, 'properties.principal.orientation_status'), ['determinate', 'indeterminate'], true)) {
            return false;
        }
        $angle = data_get($r, 'properties.principal.major_axis_angle_degrees');
        if ((data_get($r, 'properties.principal.orientation_status') === 'determinate' && ! $this->finite($angle))
            || (data_get($r, 'properties.principal.orientation_status') === 'indeterminate' && $angle !== null)) {
            return false;
        }
        foreach (['torsion_constant_j', 'warping_constant_cw', 'shear_center', 'effective_shear_area'] as $key) {
            $property = $r['advanced'][$key] ?? null;
            if (! is_array($property)) {
                return false;
            }
            if (($property['status'] ?? null) === 'not_computed') {
                if (($property['value'] ?? null) !== null || ! is_string($property['reason'] ?? null) || ! $property['reason']) {
                    return false;
                }
            } elseif (($property['status'] ?? null) === 'computed') {
                if (($property['reason'] ?? null) !== null) {
                    return false;
                }
                if (in_array($key, ['torsion_constant_j', 'warping_constant_cw'])) {
                    if (! $this->finite($property['value'] ?? null, $key !== 'warping_constant_cw') || ($key === 'warping_constant_cw' && $property['value'] < 0)) {
                        return false;
                    }
                } else {
                    foreach ($key === 'shear_center' ? ['x', 'y', 'offset_x', 'offset_y'] : ['x', 'y'] as $field) {
                        if (! $this->finite(data_get($property, 'value.'.$field), $key === 'effective_shear_area')) {
                            return false;
                        }
                    }
                }
            } else {
                return false;
            }
        }

        $report = $r['formula_report'] ?? null;
        if (! is_array($report) || ($report['schema_version'] ?? null) !== '1.0'
            || ($report['library_version'] ?? null) !== $registry['library_version']
            || ($report['core'] ?? null) !== 'section-properties/shared-typescript'
            || ($report['core_version'] ?? null) !== data_get($r, 'solver.version')
            || ($report['geometry_type'] ?? null) !== $payload['geometry']['type']
            || ($report['profile_id'] ?? null) !== $payload['profile_id']
            || ($report['units'] ?? null) !== 'mm'
            || ! is_string($report['manifest_hash'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/', $report['manifest_hash'])
            || ! is_array($report['dimensions'] ?? null) || ! is_array($report['properties'] ?? null)) {
            return false;
        }
        if (data_get($r, 'mechanics.schema_version') !== '1.0'
            || data_get($r, 'mechanics.solver_version') !== $registry['mechanics_solver_version']
            || data_get($report, 'mechanics_solver.version') !== $registry['mechanics_solver_version']
            || data_get($r, 'mechanics.geometry.status') !== 'computed'
            || data_get($r, 'mechanics.advanced.status') !== 'computed'
            || ! is_array(data_get($r, 'mechanics.geometry.representation'))
            || ! is_array(data_get($r, 'mechanics.advanced.fields'))) {
            return false;
        }
        $reportedDimensions = collect($report['dimensions'])->keyBy('key');
        foreach ($payload['geometry']['dimensions'] as $key => $value) {
            $reportedDimension = $reportedDimensions->get($key);
            if (! is_array($reportedDimension) || ! array_key_exists('value', $reportedDimension)
                || ! $this->finite($reportedDimension['value']) || $reportedDimension['value'] != $value) {
                return false;
            }
        }
        $manifestObject = json_decode(file_get_contents(base_path('../../section-properties/section-registry.json')), false, 512, JSON_THROW_ON_ERROR);
        $manifestHash = hash('sha256', json_encode($manifestObject, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        if ($report['manifest_hash'] !== $manifestHash) {
            return false;
        }
        $reportedProperties = collect($report['properties'])->keyBy('key');
        if ($reportedProperties->count() !== count($registry['properties'])) {
            return false;
        }
        foreach ($registry['properties'] as $definition) {
            $key = $definition['key'];
            $reported = $reportedProperties->get($key);
            $advanced = str_starts_with($key, 'advanced.');
            $mechanics = str_starts_with($key, 'mechanics.');
            $value = data_get($r, $advanced ? $key.'.value' : ($mechanics ? $key : 'properties.'.$key));
            if (! is_array($reported) || ($reported['unit'] ?? null) !== $definition['unit']
                || ! array_key_exists('value', $reported) || $reported['value'] != $value
                || ! is_string($reported['expression'] ?? null) || ! $reported['expression']) {
                return false;
            }
            if ($mechanics) {
                $zeroWarping = str_starts_with($key, 'mechanics.advanced.warping.modulus_')
                    && data_get($r, 'advanced.warping_constant_cw.value') === 0
                    && data_get($r, 'mechanics.advanced.warping.status') === 'not_applicable';
                if ($zeroWarping) {
                    if ($value !== null || ($reported['status'] ?? null) !== 'not_applicable' || ($reported['reason'] ?? null) !== 'zero_warping') {
                        return false;
                    }
                } elseif (! $this->finite($value) || ($reported['status'] ?? null) !== 'computed') {
                    return false;
                }
            }
            if ($advanced && (data_get($r, $key.'.status') !== 'computed' || ($reported['status'] ?? null) !== 'computed')) {
                // New saved catalog records must contain every structural property requested.
                return false;
            }
        }

        return true;
    }
}
