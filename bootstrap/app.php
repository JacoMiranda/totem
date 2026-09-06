<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'device.key' => \App\Http\Middleware\DeviceApiKeyAuth::class,
        ]);

        // Este projeto não tem tela de login servida pelo backend: o
        // painel é uma SPA com bearer token, o kiosk usa device key. Sem
        // rota `login`, o redirect padrão do auth:sanctum quebra
        // (RouteNotFoundException -> 500). Devolvendo null, o middleware
        // lança AuthenticationException e ela vira 401 (JSON na API).
        $middleware->redirectGuestsTo(fn () => null);

        // Fase 8 (hardening) - aplicado globalmente (web + api), tanto os
        // shells Blade (kiosk/admin) quanto as respostas JSON precisam
        // dos mesmos headers de segurança.
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Toda rota da API responde JSON, inclusive nos erros. Sem isto,
        // uma requisição sem `Accept: application/json` que cai no
        // `auth:sanctum` tenta redirecionar para a rota `login` (que não
        // existe numa API) e vira 500 em vez de 401.
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
