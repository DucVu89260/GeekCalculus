<?php

return [
    'engine_url' => env('SECTION_ENGINE_URL', 'http://section-engine:8001'),
    'timeout_seconds' => (float) env('SECTION_ENGINE_TIMEOUT_SECONDS', 8),
    'connect_timeout_seconds' => (float) env('SECTION_ENGINE_CONNECT_TIMEOUT_SECONDS', 2),
    'max_request_bytes' => 65_536,
];
