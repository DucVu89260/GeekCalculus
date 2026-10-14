<?php

namespace Tests\Feature\Concerns;

use Illuminate\Support\Facades\Http;

trait SectionPropertyTestSupport
{
    protected function sectionPropertyFixture(string $name = 'section-rectangle-300x500.json'): array
    {
        return json_decode(
            file_get_contents(base_path('tests/Fixtures/'.$name)),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
    }

    /** Fake only the configured native calculation endpoint; stray HTTP calls fail. */
    protected function fakeSectionPropertyCalculations(array $results): void
    {
        config(['sectional.engine_url' => 'http://section-engine.test']);
        Http::preventStrayRequests();
        $sequence = Http::sequence();
        foreach ($results as $result) {
            $sequence->push($result, 200);
        }
        Http::fake([
            'http://section-engine.test/v1/sections/calculate' => $sequence,
        ]);
    }
}
