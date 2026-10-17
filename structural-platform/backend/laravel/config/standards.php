<?php

return [
    'private_disk' => env('STANDARDS_PRIVATE_DISK', 'local'),
    'python' => env('STANDARDS_PYTHON', 'python3'),
    'extractor' => env(
        'STANDARDS_EXTRACTOR_PATH',
        base_path('../../scripts/extract_standard_outline.py'),
    ),
    'inspector_timeout_seconds' => (int) env('STANDARDS_INSPECTOR_TIMEOUT_SECONDS', 120),
    'response_cache_seconds' => (int) env('STANDARDS_CACHE_SECONDS', 60),
    'editions' => [
        'AISC360-10' => [
            'family_code' => 'AISC360',
            'edition_year' => 2010,
            'ingest_enabled' => true,
            'document_types' => ['specification', 'commentary', 'combined', 'errata', 'manual'],
        ],
        'AISC360-16' => [
            'family_code' => 'AISC360',
            'edition_year' => 2016,
            'ingest_enabled' => false,
            'document_types' => ['specification', 'commentary', 'errata', 'manual'],
        ],
        'AISC360-22' => [
            'family_code' => 'AISC360',
            'edition_year' => 2022,
            'ingest_enabled' => false,
            'document_types' => ['specification', 'commentary', 'errata', 'manual'],
        ],
        'ASCE7-10' => [
            'family_code' => 'ASCE7',
            'edition_year' => 2010,
            'ingest_enabled' => false,
            'document_types' => ['specification', 'commentary', 'errata', 'manual'],
        ],
        'ASCE7-16' => [
            'family_code' => 'ASCE7',
            'edition_year' => 2016,
            'ingest_enabled' => false,
            'document_types' => ['specification', 'commentary', 'errata', 'manual'],
        ],
        'ASCE7-22' => [
            'family_code' => 'ASCE7',
            'edition_year' => 2022,
            'ingest_enabled' => false,
            'document_types' => ['specification', 'commentary', 'errata', 'manual'],
        ],
    ],
];
