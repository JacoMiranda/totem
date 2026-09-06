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

    /**
     * Origens do dev server do Vite a liberar na CSP.
     *
     * Lê `public/hot` (onde o próprio Vite grava a URL em que está
     * escutando) em vez de manter uma lista fixa: sem isso, acessar de
     * outro aparelho da rede (`.\dev.ps1 -Rede`, Vite em
     * http://192.168.x.x:5173) tinha os scripts bloqueados pela CSP e a
     * página vinha em branco. Vale igual para um túnel HTTPS.
     *
     * @return string[]
     */
    private function origensDoVite(): array
    {
        $origens = ['http://127.0.0.1:5173', 'http://localhost:5173'];

        $hot = public_path('hot');
        if (is_file($hot)) {
            $url = trim((string) file_get_contents($hot));
            $partes = parse_url($url);
            if (! empty($partes['scheme']) && ! empty($partes['host'])) {
                $porta = isset($partes['port']) ? ':'.$partes['port'] : '';
                $origens[] = $partes['scheme'].'://'.$partes['host'].$porta;
            }
        }

        return array_values(array_unique($origens));
    }

    private function csp(): string
    {
        $script = "'self' 'wasm-unsafe-eval' blob:";
        $style = "'self' 'unsafe-inline'";
        $connect = "'self'";

        if (App::environment('local')) {
            $vite = implode(' ', $this->origensDoVite());
            $viteWs = implode(' ', array_map(
                fn (string $o) => str_replace(['http://', 'https://'], ['ws://', 'wss://'], $o),
                $this->origensDoVite(),
            ));
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
