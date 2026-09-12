<?php

use App\Http\Controllers\PulsoWebController;
use Illuminate\Support\Facades\Route;

// Duas telas React, mesmo projeto Laravel - kiosk é PWA offline (rota
// própria/scope pro Service Worker, ver vite.config.ts), admin é SPA
// comum. Sem catch-all/wildcard aqui de proposito: cada React Router
// dentro de kiosk/admin cuida das próprias sub-rotas client-side; o
// Laravel só precisa servir a página-shell na entrada.
// Sem página "welcome" padrão do Laravel aqui - não faz parte da UX real
// do Totem (o totem físico abre direto em /atendimento em modo kiosk).
// Home de marketing + cadastro self-service. O totem FÍSICO abre direto
// em /atendimento (modo quiosque), então mudar a raiz não o afeta.
Route::get('/', fn () => view('site'))->name('site');

Route::get('/atendimento/{any?}', function () {
    return view('kiosk');
})->where('any', '.*')->name('kiosk');

// Mural público de transparência - tela da recepção da empresa. Sem login;
// a SPA puxa GET /api/v1/mural/{token} sozinha (ver MuralController).
Route::get('/mural/{any?}', function () {
    return view('mural');
})->where('any', '.*')->name('mural');

Route::get('/admin/{any?}', function () {
    return view('admin');
})->where('any', '.*')->name('admin.spa');

// Pulso Rápido: QR sem totem/tablet (ver PulsoService). O token do ponto é
// fixo (impresso); cada visita gera uma sessão nova com hash próprio.
Route::get('/pulso/{token}', [PulsoWebController::class, 'iniciar'])->where('token', '[a-z0-9]{4,64}');
Route::get('/pulso/s/{hash}', fn () => view('pulso'))->where('hash', '[a-zA-Z0-9]{40}')->name('pulso');
