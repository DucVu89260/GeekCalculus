<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['properties' => 'array', 'section_properties' => 'array', 'section_properties_calculated_at' => 'immutable_datetime'];

    /** Stored canonical XY properties, suitable for structural calculations without legacy axis aliases. */
    public function calculatedProperties(): ?array
    {
        return $this->section_properties['properties'] ?? null;
    }

    /** Formula snapshot belongs to the saved result, not the current formula library. */
    public function formulaReport(): ?array
    {
        return $this->section_properties['formula_report'] ?? null;
    }

    /** Stored code-independent mechanics and stress-field coefficients. */
    public function mechanicalProperties(): ?array
    {
        return $this->section_properties['mechanics'] ?? null;
    }
}
