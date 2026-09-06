<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Headers de segurança básicos (docs/PLANO-SISTEMA-PROFISSIONAL.md, Fase
 * 8: "headers (helmet), CSP").
 *
 * - `microphone=(self)` no Permissions-Policy é proposital - o kiosk
 *   PRECISA do microfone (MediaRecorder, ver useAudioRecorder.ts) pro
 *   próprio domínio; só bloqueia terceiros embutidos.
 * - `style-src 'unsafe-inline'`: Tailwind/Vite geram algum CSS inline;
 *   restringir mais exigiria nonce por request, fora de escopo por ora.
 * - `script-src` inclui `'wasm-unsafe-eval'` e `blob:`: a transcrição
 *   offline (vosk-browser, ver lib/offline/vosk.ts) roda um build WASM do
 *   Kaldi dentro de um Web Worker criado a partir de um `blob:` -
 *   `worker-src blob:` + compilação de WebAssembly precisam disso.
 * - Em `local`, libera o dev server do Vite (127.0.0.1:5173 + ws) senão a
 *   CSP bloqueia o HMR e a página fica em branco.
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
        $response->headers->set('Content-Security-Policy', $this->csp());

        return $response;
    }

    private function csp(): string
    {
        $script = "'self' 'wasm-unsafe-eval' blob:";
        $style = "'self' 'unsafe-inline'";
        $connect = "'self'";

        if (App::environment('local')) {
            $vite = 'http://127.0.0.1:5173 http://localhost:5173';
            $viteWs = 'ws://127.0.0.1:5173 ws://localhost:5173';
            // 'unsafe-inline': o preâmbulo do React Fast Refresh
            // (@viteReactRefresh) é um <script> inline. Só em dev.
            $script .= " 'unsafe-inline' {$vite}";
            $style .= " {$vite}";
            $connect .= " {$vite} {$viteWs}";
        }

        return implode('; ', [
            "default-src 'self'",
            "script-src {$script}",
            "worker-src 'self' blob:",
            "style-src {$style}",
            "img-src 'self' data:",
            "font-src 'self' data:",
            "connect-src {$connect}",
            "media-src 'self' blob:",
            "frame-ancestors 'none'",
        ]);
    }
}
