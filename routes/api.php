<?php

use App\Http\Controllers\Api\Admin\ManifestationController as AdminManifestationController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\ClientErrorController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\LogController;
use App\Http\Controllers\Api\ManifestationController;
use App\Http\Controllers\Api\MuralController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPrefController;
use App\Http\Controllers\Api\PublicManifestationController;
use App\Http\Controllers\Api\RegistroController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RequerenteController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Base /api/v1, ver docs/API.md.
Route::prefix('v1')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    })->middleware('auth:sanctum');

    // Health (docs/API.md) - sem auth, usado na Fase 9 pra validar deploy.
    Route::get('/health', [HealthController::class, 'health']);
    Route::get('/health/devices', [HealthController::class, 'devices'])->middleware('auth:sanctum');

    // Cadastro self-service a partir da home (sem auth). Throttle apertado:
    // cria organização + usuário + totens, é alvo óbvio de abuso.
    Route::get('/planos', [RegistroController::class, 'planos']);
    Route::post('/auth/register', [RegistroController::class, 'registrar'])->middleware('throttle:10,60');

    // Auth da equipe (Sanctum bearer, não cookie/refresh - ver AuthController).
    Route::prefix('auth')->group(function () {
        Route::post('/login', [AuthController::class, 'login']);
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
            Route::patch('/me', [AuthController::class, 'atualizarPerfil']);
        });
    });

    // Totem (device key).
    Route::middleware('device.key')->group(function () {
        Route::post('/manifestations', [ManifestationController::class, 'store']);
        // Números de transparência da própria organização, pra tela de espera
        // do totem (ver MuralController::paraTotem). Não depende de mural_ativo.
        Route::get('/mural/resumo', [MuralController::class, 'paraTotem']);
        // Erros do navegador do totem -> canal `kiosk` -> /admin/logs.
        Route::post('/client-errors', [ClientErrorController::class, 'store'])->middleware('throttle:30,1');
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

        // Cadastro de requerente (pessoa/empresa) - opcional, o cidadão
        // escolhe se identificar ou seguir anônimo (modo padrão do totem).
        Route::post('/people', [RequerenteController::class, 'findOrCreatePerson']);
        Route::post('/companies', [RequerenteController::class, 'findOrCreateCompany']);
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

        // Cadastro da equipe da conta + distribuição automática (admin).
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::post('/users/transferir-carga', [UserController::class, 'transferirCarga']);
        Route::patch('/users/{user}', [UserController::class, 'update']);

        // Dispositivos (admin) - nunca via device.key (um totem não se auto-cadastra).
        // Pareamento pelo próprio kiosk (tela de login do totem): listar +
        // pegar a chave de um dispositivo. Gate atendente+, ao contrário do
        // resto da gestão de dispositivos (admin). `pareaveis` vem ANTES de
        // qualquer /devices/{...} pra não ser capturada como parâmetro.
        Route::get('/devices/pareaveis', [DeviceController::class, 'pareaveis']);
        Route::post('/devices/{device}/pair', [DeviceController::class, 'pair'])->whereUuid('device');

        Route::get('/devices', [DeviceController::class, 'index']);
        Route::post('/devices', [DeviceController::class, 'store']);
        Route::post('/devices/{device}/rotate-key', [DeviceController::class, 'rotateKey'])->whereUuid('device');
        Route::patch('/devices/{device}', [DeviceController::class, 'update'])->whereUuid('device');

        // Relatórios (analista+, ver ReportController).
        Route::prefix('reports')->group(function () {
            Route::get('/summary', [ReportController::class, 'summary']);
            Route::get('/timeseries', [ReportController::class, 'timeseries']);
            Route::get('/sla', [ReportController::class, 'sla']);
            Route::get('/export', [ReportController::class, 'export']);
        });

        // Notificações (log e teste: admin; preferências: qualquer membro
        // autenticado edita só as próprias, ver NotificationPrefController).
        Route::get('/logs', [LogController::class, 'index']);

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/test', [NotificationController::class, 'test']);
        Route::get('/notification-prefs', [NotificationPrefController::class, 'index']);
        Route::put('/notification-prefs', [NotificationPrefController::class, 'update']);

        // Mural público de transparência - ligar/desligar e pegar o link (admin da conta).
        Route::get('/mural', [MuralController::class, 'config']);
        Route::patch('/mural', [MuralController::class, 'atualizar']);
        Route::post('/mural/token', [MuralController::class, 'regenerarToken']);
    });

    // Consulta pública (sem auth) - rate-limited contra enumeração de
    // protocolo (docs/API.md: "Erros genéricos... proteção contra
    // enumeração"), separado do limite genérico da API.
    Route::middleware('throttle:20,1')->group(function () {
        Route::get('/public/manifestations/{protocolo}', [PublicManifestationController::class, 'show']);
        // LGPD (Fase 8) - eliminação/anonimização a pedido do próprio
        // cidadão, mesma verificação protocolo+PIN, mesmo throttle.
        Route::delete('/public/manifestations/{protocolo}', [PublicManifestationController::class, 'eliminar']);

        // Mural público de transparência (a tela da recepção puxa isto sozinha).
        Route::get('/mural/{token}', [MuralController::class, 'show'])->where('token', '[a-z0-9][a-z0-9-]{4,63}');
    });
});
