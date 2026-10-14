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
        $type = $shape === 'i' ? 'i_section' : $shape;
        $variant = in_array($shape, ['rectangle', 'circle']) ? 'solid' : ($shape === 'circular_hollow' ? 'uniform_wall' : 'sharp_corner');
        $dimensions = match ($shape) {
            'rectangle' => ['width' => $p['width'], 'height' => $p['depth']],
            'circle' => ['diameter' => $p['diameter']],
            'i' => [
                'depth' => $p['depth'],
                'top_flange_width' => $p['top_flange_width'] ?? $p['width'],
                'bottom_flange_width' => $p['bottom_flange_width'] ?? $p['width'],
                'web_thickness' => $p['web_thickness'],
                'top_flange_thickness' => $p['top_flange_thickness'] ?? $p['flange_thickness'],
                'bottom_flange_thickness' => $p['bottom_flange_thickness'] ?? $p['flange_thickness'],
            ],
            'rectangular_hollow' => ['width' => $p['width'], 'height' => $p['depth'], 'thickness' => $p['thickness']],
            'circular_hollow' => ['diameter' => $p['diameter'], 'thickness' => $p['thickness']],
            'channel', 'tee' => ['depth' => $p['depth'], 'width' => $p['width'], 'web_thickness' => $p['web_thickness'], 'flange_thickness' => $p['flange_thickness']],
            'angle' => ['depth' => $p['depth'], 'width' => $p['width'], 'thickness' => $p['thickness']],
            default => throw ValidationException::withMessages(['section_type_id' => ['This geometry has no section-property solver.']]),
        };

        return [
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
            || ! is_string(data_get($r, 'solver.version')) || ! data_get($r, 'solver.version')
            || ! is_string($r['geometry_hash'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/', $r['geometry_hash'])
            || ! is_array($r['diagnostics'] ?? null)) {
            return false;
        }
        $dimensions = $geometry['dimensions'] ?? [];
        if (! is_array($dimensions) || count($dimensions) !== count($payload['geometry']['dimensions'])) {
            return false;
        }
        foreach ($payload['geometry']['dimensions'] as $key => $value) {
            if (! $this->finite($dimensions[$key] ?? null, true) || $dimensions[$key] != $value) {
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
                    if (! $this->finite($property['value'] ?? null, true)) {
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

        return true;
    }
}
