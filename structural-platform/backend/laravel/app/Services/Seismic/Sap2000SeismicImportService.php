<?php

namespace App\Services\Seismic;

/** Both Excel sheets and V2 /table responses feed the same sheet/row conversion. */
final class Sap2000SeismicImportService
{
    public static function key(string $s): string
    {
        return strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $s));
    }

    private const ALIASES = [
        'source' => ['masssource', 'masssourcename', 'name'], 'pattern' => ['loadpat', 'loadpattern', 'loadpatternname', 'loadname'],
        'factor' => ['sf', 'multiplier', 'scalefactor', 'factor'], 'element_mass' => ['elementmass', 'fromelementmass', 'includeselfmass', 'massfromelements', 'selfmass', 'includeselfmass'],
        'additional_mass' => ['additionalmass', 'includeadditionalmass', 'massfromadditional'], 'from_loads' => ['fromloads', 'includeloads', 'massfromloads'],
        'case' => ['outputcase', 'loadcase', 'case', 'name'], 'case_type' => ['casetype', 'type', 'analysistype'], 'FX' => ['globalfx', 'fx'], 'FY' => ['globalfy', 'fy'], 'FZ' => ['globalfz', 'fz'],
        'mass_x' => ['massx', 'ux', 'uxmass', 'totalmassx'], 'mass_y' => ['massy', 'uy', 'uymass', 'totalmassy'],
        'step' => ['steptype', 'step'], 'step_number' => ['stepnum', 'stepnumber'], 'units' => ['units', 'unit'],
    ];

    public function preview(array $book): array
    {
        Rules::require(($book['schema_version'] ?? '') === 'sap-seismic-sheets/1', 'Unknown sheet schema');
        $sheets = [];
        foreach ($book['sheets'] ?? [] as $sheet) {
            $best = [];
            $header = null;
            foreach (array_slice($sheet['rows'], 0, 40) as $row) {
                $map = [];
                foreach ($row['cells'] as $i => $v) {
                    foreach (self::ALIASES as $key => $aliases) {
                        if (in_array(self::key((string) $v), $aliases)) {
                            $map[$key] = $i;
                        }
                    }
                }
                if (count($map) > count($best)) {
                    $best = $map;
                    $header = $row['row'];
                }
            }
            $name = self::key($sheet['name']);
            $role = (str_contains($name, 'loadcase') || str_contains($name, 'loadsapplied')) ? 'cases' : (str_contains($name, 'masssource') ? 'definition' : (str_contains($name, 'basereact') ? 'reactions' : (str_contains($name, 'masssummar') ? 'mass' : 'ignore')));
            $unitsRow = null;
            $unitsMetadata = [];
            foreach ($sheet['rows'] as $r) {
                if ($header !== null && $r['row'] === $header + 1) {
                    $tokens = array_filter(array_map(fn ($v) => strtolower(trim((string) $v)), $r['cells']));
                    $known = ['text', 'unitless', 'yes/no', 'kg', 'tonne', 'kn-s2/m', 'kip-s2/ft', 'lbm', 'kn', 'n', 'kip', 'lbf', 'kgf', 'tf', 'm', 'ft', 'sec', 's'];
                    if ($tokens && ! array_diff($tokens, $known)) {
                        $unitsRow = $r['row'];
                        $unitsMetadata = $r['cells'];
                    }
                }
            }
            $sheets[] = ['name' => $sheet['name'], 'units_row' => $unitsRow, 'units_metadata' => $unitsMetadata, 'role' => $role, 'header_row' => $header, 'columns' => $best, 'sample' => array_slice($sheet['rows'], 0, 12), 'row_count' => count($sheet['rows']), 'merged_cells' => $sheet['merged_cells'] ?? []];
        }

        return ['sheets' => $sheets, 'fields' => array_keys(self::ALIASES), 'roles' => ['ignore', 'definition', 'mass', 'reactions', 'cases'], 'warnings' => ['Review sheet roles, header row, column mapping and unit metadata. Merged titles are retained, never replicated as records.']];
    }

    public function apiSheets(array $tables): array
    {
        Rules::require(count($tables) > 0 && count($tables) <= 20, 'Select 1–20 SAP tables');
        $sheets = [];
        $model = null;
        foreach ($tables as $table) {
            Rules::require(is_array($table), 'Each SAP table must be an object');
            Rules::require(! ($table['truncated'] ?? true) && is_array($table['rows'] ?? null) && is_array($table['columns'] ?? null) && ! empty($table['columns']), 'SAP table missing, unsupported or truncated');
            Rules::require(! empty($table['model']) && ($model === null || $model === $table['model']), 'All tables must belong to the same SAP model');
            $model = $table['model'];
            Rules::require(is_string($table['table_key'] ?? null) && strlen($table['table_key']) <= 200, 'SAP table key required');
            Rules::require(is_string($model) && strlen($model) <= 2000 && count($table['columns']) <= 100 && count($table['rows']) <= 20000, 'SAP table size/model limit exceeded');
            foreach ($table['columns'] as $column) {
                Rules::require(is_string($column), 'SAP column names must be strings');
            }
            foreach ($table['rows'] as $cells) {
                Rules::require(is_array($cells) && array_is_list($cells) && count($cells) === count($table['columns']), 'SAP table dimensions do not match');
                foreach ($cells as $cell) {
                    Rules::require((is_scalar($cell) || $cell === null) && strlen((string) $cell) <= 10000, 'Invalid SAP cell');
                }
            }
            $rows = [['row' => 1, 'cells' => $table['columns']]];
            foreach ($table['rows'] as $i => $cells) {
                $rows[] = ['row' => $i + 2, 'cells' => $cells];
            }
            $sheets[] = ['name' => $table['table_key'], 'rows' => $rows, 'units' => $table['units'] ?? null];
        }

        return ['schema_version' => 'sap-seismic-sheets/1', 'origin' => 'api', 'model' => $model, 'imported_at' => gmdate(DATE_ATOM), 'sheets' => $sheets];
    }

    private function mergedIdentifier(array $sheet, int $row, int $column): ?array
    {
        $decode = static function (string $address): array {
            if (! preg_match('/^([A-Z]+)([0-9]+)$/', $address, $m)) {
                return [-1, -1];
            }
            $col = 0;
            foreach (str_split($m[1]) as $letter) {
                $col = $col * 26 + ord($letter) - 64;
            }

            return [(int) $m[2], $col - 1];
        };
        foreach ($sheet['merged_cells'] ?? [] as $ref) {
            $ends = explode(':', $ref);
            if (count($ends) !== 2) {
                continue;
            }
            [$top,$left] = $decode($ends[0]);
            [$bottom,$right] = $decode($ends[1]);
            if ($row < $top || $row > $bottom || $column < $left || $column > $right) {
                continue;
            }
            foreach ($sheet['rows'] as $anchor) {
                if ($anchor['row'] === $top) {
                    return ['value' => $anchor['cells'][$left] ?? '', 'range' => $ref, 'anchor' => $ends[0]];
                }
            }
        }

        return null;
    }

    public function normalize(array $book, array $mappings): array
    {
        $definitions = [];
        $masses = [];
        $reactions = [];
        $cases = [];
        foreach ($mappings as $mapping) {
            if (($mapping['role'] ?? 'ignore') === 'ignore') {
                continue;
            }
            $found = array_values(array_filter($book['sheets'], fn ($s) => $s['name'] === $mapping['name']));
            Rules::require(count($found) === 1, 'Mapped sheet not found');
            $sheet = $found[0];
            Rules::require(in_array($mapping['role'], ['definition', 'mass', 'reactions', 'cases']), 'Unknown sheet role');
            $header = Rules::number($mapping['header_row'] ?? null, 'Header row', 0, true);
            foreach ($sheet['rows'] as $row) {
                if ($row['row'] <= $header || $row['row'] === ($mapping['units_row'] ?? null)) {
                    continue;
                }
                $data = [];
                $mergedIdentifiers = [];
                foreach ($mapping['columns'] ?? [] as $key => $index) {
                    Rules::require(in_array($key, array_keys(self::ALIASES)) && is_numeric($index) && (int) $index >= 0, 'Invalid column map');
                    $data[$key] = trim((string) ($row['cells'][(int) $index] ?? ''));
                    // Only textual identity/settings may inherit an explicit merged anchor.
                    // Never repeat merged mass, force or multiplier quantities as new records.
                    if ($data[$key] === '' && in_array($key, ['source', 'case', 'case_type', 'element_mass', 'additional_mass', 'from_loads'], true)) {
                        $merge = $this->mergedIdentifier($sheet, (int) $row['row'], (int) $index);
                        if ($merge) {
                            $data[$key] = trim((string) $merge['value']);
                            $mergedIdentifiers[$key] = ['range' => $merge['range'], 'anchor' => $merge['anchor']];
                        }
                    }
                }
                if (! array_filter($data, fn ($v) => $v !== '')) {
                    continue;
                }
                $provenance = ['origin' => $book['origin'], 'filename' => $book['filename'] ?? null, 'sha256' => $book['sha256'] ?? null, 'model' => $book['model'] ?? null, 'sheet' => $sheet['name'], 'row' => $row['row'], 'imported_at' => $book['imported_at'], 'original_units' => $mapping['units'] ?? null, 'units_row' => $mapping['units_row'] ?? null, 'api_units' => $sheet['units'] ?? null, 'merged_identifiers' => $mergedIdentifiers];
                $number = function ($key) use ($data) {
                    Rules::require(isset($data[$key]) && is_numeric($data[$key]) && is_finite((float) $data[$key]), "Missing/non-numeric SAP $key");

                    return (float) $data[$key];
                };
                $boolean = function ($key) use ($data) {
                    $v = strtolower($data[$key] ?? '');
                    Rules::require(in_array($v, ['yes', 'no', 'true', 'false', '1', '0']), "SAP $key flag missing; map/choose explicit source settings");

                    return in_array($v, ['yes', 'true', '1']);
                };
                $id = $sheet['name'].':'.$row['row'];
                if ($mapping['role'] === 'cases') {
                    Rules::require(! empty($data['case']), 'Case definition name required');
                    $name = $data['case'];
                    $type = match (self::key($data['case_type'] ?? '')) {
                        'linearstatic','linstatic' => 'linear_static','responsespectrum','linrespspec' => 'response_spectrum','combination','combo' => 'combination',default => 'unknown'
                    };
                    if (! isset($cases[$name])) {
                        $cases[$name] = ['name' => $name, 'type' => 'unknown', 'patterns' => [], 'provenance' => []];
                    }
                    if ($type !== 'unknown') {
                        Rules::require($cases[$name]['type'] === 'unknown' || $cases[$name]['type'] === $type, 'Conflicting case type metadata');
                        $cases[$name]['type'] = $type;
                    }
                    if (! empty($data['pattern'])) {
                        Rules::require(! isset($cases[$name]['patterns'][$data['pattern']]), 'Duplicate case load-pattern definition');
                        $cases[$name]['patterns'][$data['pattern']] = $number('factor');
                    }
                    $cases[$name]['provenance'][] = $provenance;
                } elseif ($mapping['role'] === 'definition') {
                    Rules::require(! empty($data['source']), 'Mass Source name required');
                    $source = $data['source'];
                    $flags = [];
                    foreach (['element_mass', 'additional_mass', 'from_loads'] as $flag) {
                        $flags[$flag] = isset($mapping[$flag]) ? (bool) $mapping[$flag] : $boolean($flag);
                    }
                    if (! isset($definitions[$source])) {
                        $definitions[$source] = ['name' => $source, 'patterns' => [], 'flags' => $flags, 'provenance' => []];
                    }
                    Rules::require($definitions[$source]['flags'] === $flags, 'Inconsistent Mass Source flags');
                    if (! empty($data['pattern'])) {
                        $factor = $number('factor');
                        Rules::require($factor >= 0, 'Negative mass-source multiplier requires separate review');
                        Rules::require(! isset($definitions[$source]['patterns'][$data['pattern']]), 'Duplicate load-pattern row in Mass Source');
                        $definitions[$source]['patterns'][$data['pattern']] = $factor;
                    }
                    $definitions[$source]['provenance'][] = $provenance;
                } elseif ($mapping['role'] === 'mass') {
                    $unit = $mapping['units'] ?? '';
                    $massFactor = match ($unit) {
                        'kg' => 1,'tonne' => 1000,'kN-s2/m' => 1000,'kip-s2/ft' => 4448.2216152605 / .3048,'lbm' => .45359237,default => null
                    };
                    Rules::require($massFactor !== null, 'Mass unit required: kg, tonne, kN-s2/m, kip-s2/ft, lbm');
                    $masses[] = ['id' => $id, 'source' => $data['source'] ?? '', 'mass_x_kg' => $number('mass_x') * $massFactor, 'mass_y_kg' => $number('mass_y') * $massFactor, 'provenance' => $provenance];
                } else {
                    $unit = $mapping['units'] ?? '';
                    $factor = match ($unit) {
                        'kN' => 1,'N' => .001,'kip' => 4.4482216152605,'lbf' => .0044482216152605,'kgf' => .00980665,'tf' => 9.80665,default => null
                    };
                    Rules::require($factor !== null, 'Force units required: kN, N, kip, lbf, kgf, tf');
                    Rules::require(! empty($data['case']), 'Output case name required');
                    $r = ['id' => $id, 'case' => $data['case'], 'step' => $data['step'] ?? '', 'step_number' => $data['step_number'] ?? '', 'provenance' => $provenance];
                    foreach (['FX', 'FY', 'FZ'] as $key) {
                        $r[$key.'_kN'] = isset($data[$key]) && $data[$key] !== '' ? $number($key) * $factor : null;
                    }
                    $reactions[] = $r;
                }
            }
        }

        return ['schema_version' => 'sap-seismic/1', 'code_version' => Rules::tables()['version'], 'origin' => $book['origin'], 'provenance' => array_diff_key($book, ['sheets' => true]), 'definitions' => array_values($definitions), 'masses' => $masses, 'reactions' => $reactions, 'cases' => $cases];
    }
}
