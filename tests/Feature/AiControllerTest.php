<?php

namespace Tests\Feature;

use App\Models\AiCache;
use App\Models\Device;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Proxy de IA (docs/API.md, "IA (proxy) — device key") - GeminiAiService
 * nunca é chamado de verdade em teste (Http::fake), e o backoff real
 * (1s/2s/4s/8s/16s) é zerado via config só nos testes que exercitam o
 * caminho de falha - ver GeminiAiService::delaysMs().
 */
class AiControllerTest extends TestCase
{
    use RefreshDatabase;

    private function criarDevice(): array
    {
        $chaveCrua = 'chave-de-teste-'.Str::random(20);
        Device::create([
            'codigo' => 'TOTEM-IA-01',
            'nome' => 'Totem IA',
            'api_key_hash' => hash('sha256', $chaveCrua),
            'ativo' => true,
        ]);

        return [$chaveCrua];
    }

    private function respostaGeminiTexto(array $analise): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => json_encode($analise)]]]]]];
    }

    private function respostaGeminiAudio(): array
    {
        return $this->respostaGeminiTexto([
            'transcription' => 'Fila muito longa no posto de saúde hoje.',
            'sentiment' => 'Insatisfeito',
            'category' => 'Reclamação',
            'urgency' => 'Alta',
            'summary' => 'Reclamação sobre fila no posto de saúde.',
            'keywords' => ['fila', 'posto', 'saúde'],
        ]);
    }

    public function test_transcrever_audio_com_sucesso(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->respostaGeminiAudio(), 200)]);
        [$chave] = $this->criarDevice();

        $arquivo = UploadedFile::fake()->create('gravacao.webm', 100, 'audio/webm');

        $resposta = $this->post('/api/v1/ai/transcribe-analyze', ['file' => $arquivo], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJson([
            'transcription' => 'Fila muito longa no posto de saúde hoje.',
            'sentiment' => 'Insatisfeito',
            'category' => 'Reclamação',
            'urgency' => 'Alta',
            'degraded' => false,
        ]);
    }

    public function test_transcrever_audio_sem_device_key_e_rejeitado(): void
    {
        $arquivo = UploadedFile::fake()->create('gravacao.webm', 100, 'audio/webm');

        $this->post('/api/v1/ai/transcribe-analyze', ['file' => $arquivo])->assertUnauthorized();
    }

    /** Sem texto manual nenhum e a Gemini falha - erro de verdade, sem inventar transcrição (mesmo comportamento do protótipo original). */
    public function test_transcrever_audio_com_gemini_indisponivel_da_erro(): void
    {
        config(['services.gemini.retry_delays_ms' => [0, 0, 0, 0, 0]]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);
        [$chave] = $this->criarDevice();

        $arquivo = UploadedFile::fake()->create('gravacao.webm', 100, 'audio/webm');
        $resposta = $this->post('/api/v1/ai/transcribe-analyze', ['file' => $arquivo], ['X-Device-Key' => $chave]);

        $resposta->assertStatus(503);
        $resposta->assertJsonPath('error.code', 'AI_UNAVAILABLE');
    }

    /** HTTP 400 da Gemini (chave inválida etc.) falha na hora - não gasta as 5 tentativas com backoff. */
    public function test_transcrever_audio_com_gemini_400_nao_retenta(): void
    {
        $chamadas = 0;
        Http::fake(['generativelanguage.googleapis.com/*' => function () use (&$chamadas) {
            $chamadas++;

            return Http::response(['error' => ['message' => 'API key not valid', 'status' => 'INVALID_ARGUMENT']], 400);
        }]);
        [$chave] = $this->criarDevice();

        $arquivo = UploadedFile::fake()->create('gravacao.webm', 100, 'audio/webm');
        $resposta = $this->post('/api/v1/ai/transcribe-analyze', ['file' => $arquivo], ['X-Device-Key' => $chave]);

        $resposta->assertStatus(503);
        $resposta->assertJsonPath('error.code', 'AI_UNAVAILABLE');
        $this->assertSame(1, $chamadas, 'HTTP 400 não deve ser retentado');
    }

    /** JSON {texto} nesse mesmo endpoint (sem áudio) - devolve transcription = texto já conhecido. */
    public function test_transcrever_analyze_com_json_texto(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->respostaGeminiTexto([
            'sentiment' => 'Excelente', 'category' => 'Elogio', 'urgency' => 'Baixa',
            'summary' => 'Elogio ao atendimento.', 'keywords' => ['elogio', 'atendimento'],
        ]), 200)]);
        [$chave] = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/ai/transcribe-analyze', ['texto' => 'Fui muito bem atendido, parabéns a toda equipe.'], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJson(['transcription' => 'Fui muito bem atendido, parabéns a toda equipe.', 'sentiment' => 'Excelente', 'degraded' => false]);
    }

    /** Gemini indisponível MAS já existe texto (>5 chars) - cai no fallback heurístico local, nunca um erro puro. */
    public function test_transcrever_analyze_com_texto_e_gemini_indisponivel_usa_fallback(): void
    {
        config(['services.gemini.retry_delays_ms' => [0, 0, 0, 0, 0]]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);
        [$chave] = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/ai/transcribe-analyze', ['texto' => 'Reclamação sobre demora e problema no atendimento.'], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJson(['transcription' => 'Reclamação sobre demora e problema no atendimento.', 'sentiment' => 'Insatisfeito', 'category' => 'Reclamação', 'degraded' => true]);
    }

    public function test_analisar_texto_sem_transcription_no_shape(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->respostaGeminiTexto([
            'sentiment' => 'Neutro', 'category' => 'Dúvida', 'urgency' => 'Baixa',
            'summary' => 'Dúvida sobre horário.', 'keywords' => ['horário', 'dúvida'],
        ]), 200)]);
        [$chave] = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/ai/analyze-text', ['texto' => 'Onde fica o setor de protocolo?'], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJsonMissingPath('transcription');
        $resposta->assertJson(['sentiment' => 'Neutro', 'category' => 'Dúvida', 'degraded' => false]);
    }

    public function test_analisar_texto_com_gemini_indisponivel_usa_fallback_degradado(): void
    {
        config(['services.gemini.retry_delays_ms' => [0, 0, 0, 0, 0]]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);
        [$chave] = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/ai/analyze-text', ['texto' => 'Excelente atendimento, obrigado!'], ['X-Device-Key' => $chave]);

        $resposta->assertOk();
        $resposta->assertJson(['sentiment' => 'Excelente', 'category' => 'Elogio', 'degraded' => true]);
    }

    public function test_tts_cacheia_no_segundo_pedido_igual(): void
    {
        Storage::fake('local');
        $pcmBase64 = base64_encode('pcm-fake-bytes');
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'audio/L16;rate=24000', 'data' => $pcmBase64]]]]]],
        ], 200)]);
        [$chave] = $this->criarDevice();

        $primeira = $this->postJson('/api/v1/ai/tts', ['texto' => 'Obrigado pela sua visita.'], ['X-Device-Key' => $chave]);
        $primeira->assertOk();
        $primeira->assertJson(['audioBase64' => $pcmBase64, 'sampleRate' => 24000, 'cached' => false]);
        $this->assertSame(1, AiCache::where('tipo', 'tts')->count());

        $segunda = $this->postJson('/api/v1/ai/tts', ['texto' => 'Obrigado pela sua visita.'], ['X-Device-Key' => $chave]);
        $segunda->assertOk();
        $segunda->assertJson(['audioBase64' => $pcmBase64, 'sampleRate' => 24000, 'cached' => true]);

        // só 1 chamada de verdade à Gemini - a segunda veio do cache.
        Http::assertSentCount(1);
    }

    public function test_tts_com_gemini_indisponivel_da_erro(): void
    {
        config(['services.gemini.retry_delays_ms' => [0, 0, 0, 0, 0]]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);
        [$chave] = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/ai/tts', ['texto' => 'Texto qualquer.'], ['X-Device-Key' => $chave]);

        $resposta->assertStatus(503);
        $resposta->assertJsonPath('error.code', 'AI_UNAVAILABLE');
    }
}
