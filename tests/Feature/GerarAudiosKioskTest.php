<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * `ouvidoria:gerar-audios-kiosk` - pré-gera os WAV das frases fixas do
 * totem (ver config/kiosk_audio.php). Gemini nunca é chamado de verdade
 * (Http::fake devolve PCM); o teste checa que o arquivo sai como WAV
 * válido e que o manifest.json registra a entrada com hash.
 */
class GerarAudiosKioskTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = storage_path('framework/testing/audio-kiosk-'.uniqid());
        config(['kiosk_audio.saida' => $this->dir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    private function fakeTts(): void
    {
        $pcm = base64_encode(str_repeat("\x00\x01", 200));
        $part = ['inlineData' => ['mimeType' => 'audio/L16;codec=pcm;rate=24000', 'data' => $pcm]];
        $corpo = ['candidates' => [['content' => ['parts' => [$part]]]]];

        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($corpo, 200)]);
    }

    public function test_gera_wav_valido_e_manifest(): void
    {
        $this->fakeTts();

        $this->artisan('ouvidoria:gerar-audios-kiosk', ['--only' => 'boas-vindas', '--sleep' => 0])
            ->assertSuccessful();

        $wav = $this->dir.'/boas-vindas.wav';
        $this->assertFileExists($wav);
        $this->assertSame('RIFF', substr((string) file_get_contents($wav), 0, 4));
        $this->assertSame('WAVE', substr((string) file_get_contents($wav), 8, 4));

        $manifest = json_decode((string) file_get_contents($this->dir.'/manifest.json'), true);
        $this->assertSame('Aoede', $manifest['voz']);
        $this->assertArrayHasKey('boas-vindas', $manifest['frases']);
        $this->assertNotEmpty($manifest['frases']['boas-vindas']['hash']);
    }

    public function test_e_idempotente_sem_force(): void
    {
        $this->fakeTts();

        $this->artisan('ouvidoria:gerar-audios-kiosk', ['--only' => 'boas-vindas', '--sleep' => 0])->assertSuccessful();
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]); // 2ª rodada não deve chamar

        $this->artisan('ouvidoria:gerar-audios-kiosk', ['--only' => 'boas-vindas', '--sleep' => 0])
            ->expectsOutputToContain('1 sem mudança')
            ->assertSuccessful();
    }

    public function test_gera_as_25_combinacoes_de_conclusao(): void
    {
        $this->fakeTts();

        $this->artisan('ouvidoria:gerar-audios-kiosk', ['--sleep' => 0])->assertSuccessful();

        $manifest = json_decode((string) file_get_contents($this->dir.'/manifest.json'), true);
        $combos = array_filter(array_keys($manifest['frases']), fn ($id) => str_starts_with($id, 'conclusao-') && substr_count($id, '-') === 2);
        $this->assertCount(25, $combos);
        $this->assertArrayHasKey('conclusao-denuncia-insatisfeito', $manifest['frases']);
    }
}
