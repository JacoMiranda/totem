<?php

use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\ManifestationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Base /api/v1, ver docs/API.md.
Route::prefix('v1')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    })->middleware('auth:sanctum');

    // Totem (device key) - Fase 1.
    Route::middleware('device.key')->group(function () {
        Route::post('/manifestations', [ManifestationController::class, 'store']);
        Route::post('/manifestations/{manifestation}/audio', [ManifestationController::class, 'uploadAudio']);
        Route::get('/manifestations/{protocolo}', [ManifestationController::class, 'show']);
    });

    // Equipe (Sanctum) - versão mínima da Fase 1, só o suficiente pra
    // existir um device de verdade; gestão completa entra na Fase 4.
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/devices', [DeviceController::class, 'store']);
    });
});
