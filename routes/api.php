<?php

use App\Http\Controllers\Api\Admin\ManifestationController as AdminManifestationController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\ManifestationController;
use App\Http\Controllers\Api\PublicManifestationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Base /api/v1, ver docs/API.md.
Route::prefix('v1')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    })->middleware('auth:sanctum');

    // Auth da equipe (Sanctum bearer, não cookie/refresh - ver AuthController).
    Route::prefix('auth')->group(function () {
        Route::post('/login', [AuthController::class, 'login']);
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
        });
    });

    // Totem (device key).
    Route::middleware('device.key')->group(function () {
        Route::post('/manifestations', [ManifestationController::class, 'store']);
        Route::post('/manifestations/{manifestation}/audio', [ManifestationController::class, 'uploadAudio'])->whereUuid('manifestation');
        // Constrangido ao formato do protocolo (OUV-AAAAMM-NNNNNN) pra não
        // colidir com GET /manifestations/{manifestation} (admin, por uuid)
        // abaixo - mesmo path shape, discriminado pelo formato do parâmetro,
        // não pela ordem de registro das rotas.
        Route::get('/manifestations/{protocolo}', [ManifestationController::class, 'show'])->where('protocolo', 'OUV-\d{6}-\d{6}');

        // Proxy de IA - só o totem chama, nunca o painel admin.
        Route::prefix('ai')->group(function () {
            Route::post('/transcribe-analyze', [AiController::class, 'transcreverEAnalisar']);
            Route::post('/analyze-text', [AiController::class, 'analisarTexto']);
            Route::post('/tts', [AiController::class, 'tts']);
        });
    });

    // Painel (Sanctum bearer, RBAC via Gates - ver AppServiceProvider).
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/manifestations', [AdminManifestationController::class, 'index']);
        Route::get('/manifestations/{manifestation}', [AdminManifestationController::class, 'show'])->whereUuid('manifestation');
        Route::get('/manifestations/{manifestation}/audio', [AdminManifestationController::class, 'audio'])->whereUuid('manifestation');
        Route::patch('/manifestations/{manifestation}/status', [AdminManifestationController::class, 'updateStatus'])->whereUuid('manifestation');
        Route::patch('/manifestations/{manifestation}/assign', [AdminManifestationController::class, 'assign'])->whereUuid('manifestation');
        Route::patch('/manifestations/{manifestation}/classify', [AdminManifestationController::class, 'classify'])->whereUuid('manifestation');
        Route::post('/manifestations/{manifestation}/notes', [AdminManifestationController::class, 'addNote'])->whereUuid('manifestation');
        Route::post('/manifestations/{manifestation}/resposta', [AdminManifestationController::class, 'resposta'])->whereUuid('manifestation');

        // Dispositivos (admin) - nunca via device.key (um totem não se auto-cadastra).
        Route::get('/devices', [DeviceController::class, 'index']);
        Route::post('/devices', [DeviceController::class, 'store']);
        Route::post('/devices/{device}/rotate-key', [DeviceController::class, 'rotateKey'])->whereUuid('device');
        Route::patch('/devices/{device}', [DeviceController::class, 'update'])->whereUuid('device');
    });

    // Consulta pública (sem auth) - rate-limited contra enumeração de
    // protocolo (docs/API.md: "Erros genéricos... proteção contra
    // enumeração"), separado do limite genérico da API.
    Route::middleware('throttle:20,1')->get('/public/manifestations/{protocolo}', [PublicManifestationController::class, 'show']);
});
