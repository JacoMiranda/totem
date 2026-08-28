<?php

namespace App\Console\Commands;

use App\Exceptions\AiUnavailableException;
use App\Services\Ai\GeminiAiService;
use App\Support\Wav;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Gera (uma única vez) os WAV das frases FIXAS do totem a partir do
 * catálogo em config/kiosk_audio.php - ver o comentário lá. Idempotente:
 * pula frases cujo texto não mudou desde a última geração (hash guardado
 * no manifest.json), a menos que `--force`. `--only=` restringe a ids
 * específicos (lista separada por vírgula).
 *
 * Roda LOCAL/no deploy, nunca em request. Os WAV e o manifest.json ficam
 * versionados em public/audio/kiosk/ (não são build de Vite).
 */
class GerarAudiosKiosk extends Command
{
    protected $signature = 'ouvidoria:gerar-audios-kiosk
        {--force : Regera mesmo se o texto não mudou}
        {--only= : Só estes ids (separados por vírgula)}
        {--sleep=4 : Segundos de pausa entre chamadas (a cota do TTS preview é baixa)}
        {--limite=0 : Para após N áudios gerados nesta execução (0 = sem limite). Útil pra respeitar a cota diária do free tier}
        {--reconstruir : Não chama a API - só reescreve o manifest.json a partir dos .wav já em disco}';

    protected $description = 'Pré-gera os áudios das frases fixas do totem (TTS Gemini => WAV estático)';

    public function handle(GeminiAiService $gemini): int
    {
        $config = config('kiosk_audio');
        $voz = $config['voz'];
        $dir = $config['saida'];

        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            $this->error("Não foi possível criar {$dir}");

            return self::FAILURE;
        }

        $manifestPath = $dir.DIRECTORY_SEPARATOR.'manifest.json';
        $manifestAtual = is_file($manifestPath)
            ? (json_decode((string) file_get_contents($manifestPath), true) ?: [])
            : [];
        $hashesAntigos = collect($manifestAtual['frases'] ?? [])->map(fn ($f) => $f['hash'] ?? null);

        $alvo = $this->option('only')
            ? array_filter(array_map('trim', explode(',', (string) $this->option('only'))))
            : null;

        $frases = $this->catalogo($config);

        if ($this->option('reconstruir')) {
            return $this->reconstruirManifest($frases, $voz, $dir, $manifestPath);
        }

        $manifestFrases = [];
        $gerados = 0;
        $pulados = 0;
        $falhas = [];
        $sleep = max(0, (int) $this->option('sleep'));
        $limite = max(0, (int) $this->option('limite'));
        $primeiraChamada = true;

        foreach ($frases as $id => $texto) {
            if ($alvo !== null && ! in_array($id, $alvo, true)) {
                // preserva no manifest o que já existe e não é alvo agora
                if (isset($manifestAtual['frases'][$id])) {
                    $manifestFrases[$id] = $manifestAtual['frases'][$id];
                }

                continue;
            }

            $hash = sha1($voz.'|'.$texto);
            $arquivo = "{$id}.wav";
            $caminho = $dir.DIRECTORY_SEPARATOR.$arquivo;

            if (! $this->option('force') && is_file($caminho) && $hashesAntigos->get($id) === $hash) {
                $manifestFrases[$id] = $manifestAtual['frases'][$id];
                $pulados++;

                continue;
            }

            $this->line("  gerando <info>{$id}</info> — \"".Str::limit($texto, 60).'"');

            // Cota do modelo TTS preview é baixa (poucas req/min) - espaça
            // as chamadas. Não dorme antes da primeira nem depois da última.
            if (! $primeiraChamada && $sleep > 0) {
                sleep($sleep);
            }
            $primeiraChamada = false;

            try {
                $tts = $gemini->textoParaFala($texto, $voz);
            } catch (AiUnavailableException $e) {
                // Não aborta: registra e segue. Como o comando é idempotente,
                // rodar de novo mais tarde só tenta os que faltaram.
                $this->warn("  falhou ({$id}): {$e->getMessage()}");
                $falhas[] = $id;
                if (isset($manifestAtual['frases'][$id])) {
                    $manifestFrases[$id] = $manifestAtual['frases'][$id];
                }

                continue;
            }

            $wav = Wav::fromPcm16Mono(base64_decode($tts['audioBase64']), (int) $tts['sampleRate']);
            file_put_contents($caminho, $wav);

            $manifestFrases[$id] = [
                'arquivo' => $arquivo,
                'texto' => $texto,
                'hash' => $hash,
                'bytes' => strlen($wav),
                'sampleRate' => (int) $tts['sampleRate'],
            ];
            $gerados++;

            if ($limite > 0 && $gerados >= $limite) {
                $this->line("  limite de {$limite} atingido nesta execução - pare aqui e rode de novo depois.");
                // preserva no manifest o resto que já existia
                foreach ($frases as $restoId => $_) {
                    if (! isset($manifestFrases[$restoId]) && isset($manifestAtual['frases'][$restoId])) {
                        $manifestFrases[$restoId] = $manifestAtual['frases'][$restoId];
                    }
                }
                break;
            }
        }

        ksort($manifestFrases);
        file_put_contents($manifestPath, json_encode([
            'voz' => $voz,
            'geradoEm' => now()->toIso8601String(),
            'frases' => $manifestFrases,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $this->info("Pronto: {$gerados} gerado(s), {$pulados} sem mudança. manifest.json atualizado.");

        if ($falhas !== []) {
            $this->warn(count($falhas).' falharam (rode o comando de novo para retomar): '.implode(', ', $falhas));

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    /** Reescreve o manifest.json a partir dos .wav que já existem em disco (sem tocar na API). */
    private function reconstruirManifest(array $frases, string $voz, string $dir, string $manifestPath): int
    {
        $manifestFrases = [];
        foreach ($frases as $id => $texto) {
            $caminho = $dir.DIRECTORY_SEPARATOR."{$id}.wav";
            if (! is_file($caminho)) {
                continue;
            }
            $manifestFrases[$id] = [
                'arquivo' => "{$id}.wav",
                'texto' => $texto,
                'hash' => sha1($voz.'|'.$texto),
                'bytes' => filesize($caminho),
                'sampleRate' => 24000,
            ];
        }

        ksort($manifestFrases);
        file_put_contents($manifestPath, json_encode([
            'voz' => $voz,
            'geradoEm' => now()->toIso8601String(),
            'frases' => $manifestFrases,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $this->info(count($manifestFrases).' áudio(s) em disco registrados no manifest.json.');

        return self::SUCCESS;
    }

    /**
     * Achata o catálogo (frases fixas + as 25 combinações de conclusão)
     * em [id => texto].
     *
     * @return array<string, string>
     */
    private function catalogo(array $config): array
    {
        $frases = $config['frases'];

        $combos = $config['conclusao_combos'];
        foreach ($combos['categorias'] as $catSlug => $catLabel) {
            foreach ($combos['sentimentos'] as $sentSlug => $sentLabel) {
                $id = "conclusao-{$catSlug}-{$sentSlug}";
                $frases[$id] = strtr($combos['template'], [
                    ':categoria' => $catLabel,
                    ':sentimento' => $sentLabel,
                ]);
            }
        }

        return $frases;
    }
}
