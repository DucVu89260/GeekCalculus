<?php

use App\Http\Controllers\EngineeringController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [EngineeringController::class, 'health']);
Route::get('/catalog', [EngineeringController::class, 'catalog']);
Route::get('/projects', [EngineeringController::class, 'index']);
Route::post('/projects', [EngineeringController::class, 'store'])->middleware('throttle:60,1');
