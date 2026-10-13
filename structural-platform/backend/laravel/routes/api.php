<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DoublySymmetricIController;
use App\Http\Controllers\EngineeringController;
use App\Http\Controllers\LibraryController;
use App\Http\Controllers\LibraryTransferController;
use App\Http\Controllers\SectionalCalculationController;
use App\Http\Controllers\UserAdminController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [EngineeringController::class, 'health']);
Route::middleware('web')->group(function () {
    Route::get('/auth/csrf', [AuthController::class, 'csrf']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::middleware('auth')->group(function () {
        Route::prefix('v1')->group(function () {
            Route::post('/steel-design/components/hi-doubly-symmetric/legacy-parity', [DoublySymmetricIController::class, 'calculate'])->middleware('throttle:60,1');
            Route::post('/sections/calculate', [SectionalCalculationController::class, 'calculate'])->middleware('throttle:60,1');
            Route::get('/section-types', [SectionalCalculationController::class, 'sectionTypes'])->middleware('throttle:60,1');
        });
        Route::get('/catalog', [EngineeringController::class, 'catalog']);
        Route::get('/projects', [EngineeringController::class, 'index']);
        Route::post('/projects', [EngineeringController::class, 'store'])->middleware('throttle:60,1');
        Route::get('/library/schema', [LibraryController::class, 'schema']);
        Route::middleware('admin')->group(function () {
            Route::get('/library/export', [LibraryTransferController::class, 'export']);
            Route::post('/library/import', [LibraryTransferController::class, 'import'])->middleware('throttle:10,1');
        });
        foreach (['materials', 'section-types', 'sections'] as $resource) {
            Route::get('/'.$resource, [LibraryController::class, 'index'])->defaults('resource', $resource);
            Route::middleware('admin')->group(function () use ($resource) {
                Route::post('/'.$resource, [LibraryController::class, 'store'])->defaults('resource', $resource);
                Route::patch('/'.$resource.'/{id}', [LibraryController::class, 'update'])->whereNumber('id')->defaults('resource', $resource);
                Route::delete('/'.$resource.'/{id}', [LibraryController::class, 'destroy'])->whereNumber('id')->defaults('resource', $resource);
            });
        }
        Route::prefix('admin')->middleware('admin')->group(function () {
            Route::get('/users', [UserAdminController::class, 'index']);
            Route::post('/users', [UserAdminController::class, 'store']);
            Route::patch('/users/{user}', [UserAdminController::class, 'update']);
            Route::delete('/users/{user}', [UserAdminController::class, 'destroy']);
        });
    });
});
