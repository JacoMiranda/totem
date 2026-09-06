<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use PharData;
use ZipArchive;

/**
 * Baixa o modelo de reconhecimento de fala offline (Vosk pt-BR pequeno) e
 * o repackaging pra `.tar.gz` que a lib `vosk-browser` espera - o site
 * oficial distribui em `.zip`. Fica em `public/models/vosk/` (gitignored,
 * ~32 MB); o Service Worker do kiosk cacheia em runtime (ver vite.config.ts)
 * pra funcionar offline depois. Ver docs/CAMADA-OFFLINE.md.
 */
class BaixarModeloVosk extends Command
{
    protected $signature = 'ouvidoria:baixar-modelo-vosk {--force : Rebaixa mesmo se já existir}';

    protected $description = 'Baixa o modelo Vosk pt-BR (transcrição offline do kiosk) e converte pra .tar.gz';

    private const ZIP_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip';

    private const NOME = 'vosk-model-small-pt-0.3';

    public function handle(): int
    {
        $destino = public_path('models/vosk');
        $targz = $destino."/".self::NOME.'.tar.gz';

        if (! $this->option('force') && is_file($targz)) {
            $this->info('Modelo já existe: '.$targz.' (use --force pra rebaixar)');

            return self::SUCCESS;
        }

        @mkdir($destino, 0775, true);
        $tmp = sys_get_temp_dir().'/'.self::NOME.'-'.uniqid();
        @mkdir($tmp.'/extract', 0775, true);
        $zip = $tmp.'/model.zip';

        $this->line('Baixando '.self::ZIP_URL.' ...');
        $resp = Http::timeout(300)->sink($zip)->get(self::ZIP_URL);
        if (! $resp->successful()) {
            $this->error('Falha no download: HTTP '.$resp->status());

            return self::FAILURE;
        }
        $this->line('  '.number_format(filesize($zip) / 1048576, 1).' MB baixados. Extraindo...');

        $za = new ZipArchive;
        if ($za->open($zip) !== true) {
            $this->error('ZIP inválido.');

            return self::FAILURE;
        }
        $za->extractTo($tmp.'/extract');
        $za->close();

        if (! is_dir($tmp.'/extract/'.self::NOME)) {
            $this->error('Estrutura inesperada no ZIP (esperava a pasta '.self::NOME.').');

            return self::FAILURE;
        }

        // PharData gera .tar depois comprime pra .tar.gz. Remove versões
        // antigas antes (o Phar não sobrescreve). O tar contém a pasta
        // `vosk-model-small-pt-0.3/...` na raiz - é o que vosk-browser espera.
        @unlink($targz);
        @unlink($tmp.'/'.self::NOME.'.tar');
        $this->line('Compactando pra .tar.gz...');
        $phar = new PharData($tmp.'/'.self::NOME.'.tar');
        $phar->buildFromDirectory($tmp.'/extract');
        $phar->compress(\Phar::GZ);
        unset($phar);

        rename($tmp.'/'.self::NOME.'.tar.gz', $targz);
        $this->deleteDir($tmp);

        $this->info('Pronto: '.$targz.' ('.number_format(filesize($targz) / 1048576, 1).' MB)');

        return self::SUCCESS;
    }

    private function deleteDir(string $dir): void
    {
        foreach (scandir($dir) ?: [] as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $caminho = $dir.'/'.$item;
            is_dir($caminho) ? $this->deleteDir($caminho) : @unlink($caminho);
        }
        @rmdir($dir);
    }
}
