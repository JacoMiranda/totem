<?php

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

Route::get('/admin/{any?}', function () {
    return view('admin');
})->where('any', '.*')->name('admin.spa');
