<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'service' => 'GeekCalculus API',
    'health' => '/api/health',
    'catalog' => '/api/catalog?locale=vi',
]));
