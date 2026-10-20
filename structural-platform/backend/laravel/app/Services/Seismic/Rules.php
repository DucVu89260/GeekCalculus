<?php

namespace App\Services\Seismic;

use InvalidArgumentException;

final class Rules
{
    public static function tables(): array
    {
        return json_decode(file_get_contents(dirname(__DIR__, 5).'/standards/asce7-10-seismic-v1.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    public static function number(mixed $v, string $name, float $min = 0, bool $positive = false): float
    {
        if (! is_numeric($v) || ! is_finite((float) $v) || ($positive ? (float) $v <= $min : (float) $v < $min)) {
            throw new InvalidArgumentException("$name: finite ".($positive ? '>' : '>=')." $min required");
        }

        return (float) $v;
    }

    public static function interpolate(float $v, array $xs, array $ys): float
    {
        if ($v <= $xs[0]) {
            return (float) $ys[0];
        }
        foreach ($xs as $i => $x) {
            if ($i && $v <= $x) {
                return $ys[$i - 1] + ($ys[$i] - $ys[$i - 1]) * ($v - $xs[$i - 1]) / ($x - $xs[$i - 1]);
            }
        }

        return (float) end($ys);
    }

    public static function require(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new InvalidArgumentException($message);
        }
    }
}
