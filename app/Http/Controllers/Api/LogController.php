<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * Leitura dos logs pela tela /admin/logs. Só LÊ arquivo, nunca escreve nem
 * executa nada. Gate `ver-logs` (admin) - é informação operacional
 * sensível (mensagens de erro podem conter caminho, e-mail, id).
 *
 * Junta o log do servidor (`laravel.log`) com o do navegador do totem
 * (`kiosk.log`, canal `kiosk`, alimentado por ClientErrorController) numa
 * lista só, ordenada por hora.
 */
class LogController extends Controller
{
    private const MAX_LINHAS = 500;

    private const NIVEIS = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('ver-logs');

        $linhas = min(self::MAX_LINHAS, max(20, (int) $request->integer('linhas', 200)));
        $nivelMin = $this->nivelIndex($request->string('nivel')->lower()->toString());

        $entradas = collect()
            ->merge($this->lerArquivo(storage_path('logs/laravel.log'), 'servidor'))
            ->merge($this->lerArquivo($this->ultimoArquivoKiosk(), 'totem'))
            ->filter(fn (array $e) => $this->nivelIndex($e['nivel']) >= $nivelMin)
            ->sortByDesc('hora')
            ->take($linhas)
            ->values();

        return response()->json([
            'niveis' => self::NIVEIS,
            'total' => $entradas->count(),
            'entradas' => $entradas,
        ]);
    }

    /**
     * Faz o parse de um arquivo de log padrão do Laravel/Monolog:
     * `[2026-09-06 10:11:12] production.ERROR: mensagem {json}` seguido,
     * às vezes, de várias linhas de stack trace (que colamos como
     * `detalhe`, truncado).
     *
     * @return array<int, array{hora: string, origem: string, ambiente: string, nivel: string, mensagem: string, detalhe: ?string}>
     */
    private function lerArquivo(?string $caminho, string $origem): array
    {
        if (! $caminho || ! is_file($caminho) || ! is_readable($caminho)) {
            return [];
        }

        // Lê só o fim do arquivo - um laravel.log de produção pode ter MB.
        $conteudo = $this->tail($caminho, 256 * 1024);
        $linhas = preg_split('/\R/', $conteudo) ?: [];

        $entradas = [];
        $atual = null;
        $inicio = '/^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})[^\]]*\]\s+([a-z0-9_-]+)\.([A-Z]+):\s?(.*)$/i';

        foreach ($linhas as $linha) {
            if (preg_match($inicio, $linha, $m)) {
                if ($atual) {
                    $entradas[] = $this->finalizar($atual, $origem);
                }
                $atual = [
                    'hora' => str_replace('T', ' ', $m[1]),
                    'ambiente' => $m[2],
                    'nivel' => strtolower($m[3]),
                    'mensagem' => trim($m[4]),
                    'linhasExtra' => [],
                ];

                continue;
            }

            if ($atual !== null && trim($linha) !== '' && count($atual['linhasExtra']) < 6) {
                $atual['linhasExtra'][] = rtrim($linha);
            }
        }
        if ($atual) {
            $entradas[] = $this->finalizar($atual, $origem);
        }

        return $entradas;
    }

    private function finalizar(array $a, string $origem): array
    {
        $detalhe = $a['linhasExtra'] !== [] ? Str::limit(implode("\n", $a['linhasExtra']), 800) : null;

        return [
            'hora' => $a['hora'],
            'origem' => $origem,
            'ambiente' => $a['ambiente'],
            'nivel' => $a['nivel'],
            'mensagem' => Str::limit($a['mensagem'], 600),
            'detalhe' => $detalhe,
        ];
    }

    /** Últimos $bytes de um arquivo, sem carregar tudo na memória. */
    private function tail(string $caminho, int $bytes): string
    {
        $tamanho = filesize($caminho) ?: 0;
        $ler = min($bytes, $tamanho);
        $fp = fopen($caminho, 'rb');
        if (! $fp) {
            return '';
        }
        if ($ler < $tamanho) {
            fseek($fp, -$ler, SEEK_END);
        }
        $dados = stream_get_contents($fp) ?: '';
        fclose($fp);

        return $dados;
    }

    private function ultimoArquivoKiosk(): ?string
    {
        $arquivos = glob(storage_path('logs/kiosk-*.log')) ?: [];
        if ($arquivos === []) {
            return is_file(storage_path('logs/kiosk.log')) ? storage_path('logs/kiosk.log') : null;
        }
        rsort($arquivos);

        return $arquivos[0];
    }

    private function nivelIndex(string $nivel): int
    {
        $i = array_search($nivel, self::NIVEIS, true);

        return $i === false ? 0 : $i;
    }
}
