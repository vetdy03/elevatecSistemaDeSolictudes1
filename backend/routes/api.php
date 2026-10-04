<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BatchController;
use App\Http\Controllers\Api\ExcelController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PdfController;
use App\Http\Controllers\Api\RequestController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read', [NotificationController::class, 'markAllRead']);

    // Lectura: todos los roles
    Route::get('/batches', [BatchController::class, 'index']);
    Route::get('/batches/active', [BatchController::class, 'active']);
    Route::get('/batches/{batch}', [BatchController::class, 'show']);
    Route::get('/requests/options', [RequestController::class, 'options']);

    // Admin: decisiones y cierre de lote
    Route::middleware('role:admin')->group(function () {
        Route::patch('/requests/{financialRequest}/status', [RequestController::class, 'updateStatus']);
        Route::post('/batches/{batch}/finalize', [BatchController::class, 'finalize']);
    });

    // Secretaría (y Admin): carga de lotes, filas manuales y reportes
    Route::middleware('role:admin,secretaria')->group(function () {
        Route::post('/requests', [RequestController::class, 'store']);
        Route::post('/excel/preview', [ExcelController::class, 'preview']);
        Route::post('/excel/import', [ExcelController::class, 'import']);
        Route::get('/excel/template', [ExcelController::class, 'template']);
        Route::get('/excel/export', [ExcelController::class, 'export']);
        Route::get('/pdf/export', [PdfController::class, 'export']);
    });
});
