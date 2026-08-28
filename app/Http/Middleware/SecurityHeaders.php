<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Headers de segurança básicos (docs/PLANO-SISTEMA-PROFISSIONAL.md, Fase
 * 8: "headers (helmet), CSP"). `microphone=(self)` no Permissions-Policy
 * é proposital - o kiosk PRECISA de acesso ao microfone (MediaRecorder,
 * ver useAudioRecorder.ts) pro próprio domínio, só bloqueia terceiros
 * embutidos. `style-src 'unsafe-inline'` fica porque o Tailwind/Vite
 * geram algum CSS inline em produção - restringir mais exigiria nonce por
 * request, fora de escopo por ora.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ".
            "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; ".
            "frame-ancestors 'none'",
        );

        return $response;
    }
}
