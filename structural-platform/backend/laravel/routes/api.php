<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PersonalPdfNoteController;
use App\Http\Controllers\MemberForceController;
use App\Http\Controllers\StandardsController;
use App\Http\Controllers\StandardsReviewController;
use App\Http\Controllers\ComboGeneratorWorkspaceController;
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
        Route::prefix('v1/personal-pdf-notes')->group(function () {
            Route::get('/', [PersonalPdfNoteController::class, 'index']);
            Route::post('/', [PersonalPdfNoteController::class, 'store'])->middleware('throttle:20,1');
            Route::get('/{id}/file', [PersonalPdfNoteController::class, 'file'])->whereUuid('id');
            Route::patch('/{id}', [PersonalPdfNoteController::class, 'update'])->whereUuid('id');
            Route::delete('/{id}', [PersonalPdfNoteController::class, 'destroy'])->whereUuid('id');
        });
        Route::post('/API_IF_SAP26.2.0_V1/{operation}', [MemberForceController::class, 'process'])
            ->whereIn('operation', ['extremes', 'connection-export'])->middleware('throttle:30,1');
        Route::prefix('v1')->group(function () {
            Route::post('/sections/calculate', [SectionalCalculationController::class, 'calculate'])->middleware('throttle:60,1');
            Route::get('/section-types', [SectionalCalculationController::class, 'sectionTypes'])->middleware('throttle:60,1');
            Route::get('/combo-generator/workspace', [ComboGeneratorWorkspaceController::class, 'show']);
            Route::put('/combo-generator/workspace', [ComboGeneratorWorkspaceController::class, 'update'])->middleware('throttle:20,1');
        });
        Route::prefix('v1/seismic')->middleware('throttle:30,1')->group(function () {
            Route::get('/coefficients', [\App\Http\Controllers\SeismicController::class, 'coefficients']);
            Route::post('/imports/preview', [\App\Http\Controllers\SeismicController::class, 'preview']);
            Route::post('/imports/{id}/confirm', [\App\Http\Controllers\SeismicController::class, 'confirm'])->whereNumber('id');
            Route::post('/calculate', [\App\Http\Controllers\SeismicController::class, 'calculate']);
            Route::get('/runs/{id}', [\App\Http\Controllers\SeismicController::class, 'run'])->whereNumber('id');
        });
        Route::get('/v1/standards', [StandardsController::class, 'index']);
        Route::get('/v1/standards/{code}', [StandardsController::class, 'show']);
        Route::get('/v1/standards/{code}/clauses', [StandardsController::class, 'clauses']);
        Route::get('/v1/standards/{code}/equations', [StandardsController::class, 'equations']);
        Route::get('/v1/standards/{code}/source-pages', [StandardsController::class, 'sourcePages']);
        Route::get('/v1/standards/{code}/source-items', [StandardsController::class, 'sourceItems']);
        Route::get('/v1/standards/{code}/documents/{id}/pages/{page}', [StandardsController::class, 'sourcePage'])->whereNumber(['id','page']);
        Route::get('/v1/standards/{code}/documents/{id}/pages/{page}/image', [StandardsController::class, 'sourceImage'])->whereNumber(['id','page']);
        Route::get('/v1/standards/{code}/documents/{id}/corpus', [StandardsController::class, 'corpus'])->whereNumber('id');
        Route::get('/v1/standards/{code}/parameters', [StandardsController::class, 'parameters']);
        Route::get('/v1/standards/{code}/tables', [StandardsController::class, 'tables']);
        Route::get('/v1/standards/{code}/search', [StandardsController::class, 'search']);
        Route::get('/v1/standards/{code}/rules', [StandardsController::class, 'approvedRules']);
        Route::get('/v1/standards/{code}/notes', [StandardsController::class, 'notes']);
        Route::post('/v1/standards/{code}/notes', [StandardsController::class, 'createNote'])->middleware('throttle:30,1');
        Route::get('/v1/standards/{code}/documents/{id}/file', [StandardsController::class, 'document'])->whereNumber('id');
        Route::post('/v1/standards/{code}/documents', [StandardsController::class, 'upload'])->middleware(['admin','throttle:10,1']);
        Route::prefix('v1/admin/standards/{code}')->middleware('admin')->group(function () {
            Route::patch('/{resource}/{id}', [StandardsReviewController::class, 'edit'])
                ->whereIn('resource', ['clauses', 'equations', 'parameters', 'tables'])->whereNumber('id');
            Route::post('/{resource}/{id}/review', [StandardsReviewController::class, 'transition'])
                ->whereIn('resource', ['documents', 'clauses', 'equations', 'parameters', 'tables'])->whereNumber('id');
            Route::get('/{resource}/{id}/history', [StandardsReviewController::class, 'history'])
                ->whereIn('resource', ['documents', 'clauses', 'equations', 'parameters', 'tables'])->whereNumber('id');
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
