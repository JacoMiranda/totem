<?php

namespace App\Services\Ai;

use App\Exceptions\AiUnavailableException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Proxy servidor pra API Gemini - porta fiel de
 * `cabine_de_ouvidoria_inteligente.html` (`processAudioRecording`,
 * `triggerManualAnalysis`, `speakTextDirectly`/TTS), NUNCA reescrita "melhor":
 * mesmo `systemInstruction`, mesmo `responseSchema`, mesmos valores de enum
 * (com acento, no VALUE - ver App\Enums). A única mudança real é que a chave
 * (`GEMINI_API_KEY`) agora só existe aqui no servidor - o protótipo original
 * a expunha direto no HTML (`const apiKey = ""`), o que é exatamente o bug
 * de segurança que motivou esta reescrita (docs/ARQUITETURA.md: "Segredos só
 * no servidor").
 *
 * Retry com backoff espelha `fetchWithRetry` do protótipo (1s/2s/4s/8s/16s,
 * 5 tentativas) em vez do padrão de failover entre múltiplos provedores do
 * política-laravel (AiFailoverService) - aqui só existe UM provedor (Gemini),
 * não uma fila de candidatos.
 */
class GeminiAiService
{
    /** @var int[] atrasos em ms entre tentativas, espelha fetchWithRetry */
    private const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

    private const MAX_TENTATIVAS = 5;

    /**
     * Porta de `processAudioRecording`: transcreve + classifica um áudio.
     *
     * @return array{transcription: string, sentiment: string, category: string, urgency: string, summary: string, keywords: string[]}
     */
    public function analisarAudio(string $base64Audio, string $mimeType): array
    {
        $cleanMime = explode(';', $mimeType)[0] ?: 'audio/webm';

        $systemInstruction = <<<'TEXT'
        És um especialista em ouvidoria pública e análise de atendimento ao cidadão.
        Receberás uma gravação em áudio com o depoimento de um cidadão.
        Instruções:
        1. Transcrever com fidelidade tudo o que foi dito para o campo "transcription" em português.
        2. Identificar o sentimento predominante: escolhe estritamente um de ["Excelente", "Satisfeito", "Neutro", "Preocupado", "Insatisfeito"].
        3. Identificar o teor da manifestação: escolhe estritamente um de ["Elogio", "Sugestão", "Dúvida", "Reclamação", "Denúncia"].
        4. Definir o nível de urgência: escolhe estritamente um de ["Baixa", "Média", "Alta", "Crítica"].
        5. Gerar um resumo claro e objetivo em 1 a 2 frases para o campo "summary".
        6. Extrair 3 a 5 palavras-chave para o campo "keywords".
        Responde exclusivamente no schema JSON definido.
        TEXT;

        $payload = [
            'contents' => [[
                'parts' => [
                    ['text' => 'Transcreva este áudio e organize a manifestação de ouvidoria:'],
                    ['inlineData' => ['mimeType' => $cleanMime, 'data' => $base64Audio]],
                ],
            ]],
            'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                // thinkingBudget=0: gemini-2.5-flash (sucessor do modelo
                // preview original, descontinuado) ativa "thinking" estendido
                // por padrão - achado real: uma chamada simples de
                // classificação levou >30s (estourou max_execution_time do
                // PHP) sem isso. Essa tarefa é classificação direta, não
                // precisa de raciocínio estendido.
                'thinkingConfig' => ['thinkingBudget' => 0],
                'responseSchema' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'transcription' => ['type' => 'STRING'],
                        'sentiment' => ['type' => 'STRING', 'enum' => ['Excelente', 'Satisfeito', 'Neutro', 'Preocupado', 'Insatisfeito']],
                        'category' => ['type' => 'STRING', 'enum' => ['Elogio', 'Sugestão', 'Dúvida', 'Reclamação', 'Denúncia']],
                        'urgency' => ['type' => 'STRING', 'enum' => ['Baixa', 'Média', 'Alta', 'Crítica']],
                        'summary' => ['type' => 'STRING'],
                        'keywords' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    ],
                    'required' => ['transcription', 'sentiment', 'category', 'urgency', 'summary', 'keywords'],
                ],
            ],
        ];

        // gerarConteudoComRetry já devolve o objeto decodificado (extrai o
        // JSON internamente) - chamar extrairJson() de novo aqui em cima do
        // resultado (um array, não mais a string bruta) quebrava com
        // TypeError (achado real por teste com Http::fake).
        return $this->gerarConteudoComRetry(config('services.gemini.text_model'), $payload);
    }

    /**
     * Porta de `triggerManualAnalysis`: classifica um texto já transcrito
     * (sem o campo "transcription" no schema - o texto já é conhecido).
     *
     * @return array{sentiment: string, category: string, urgency: string, summary: string, keywords: string[]}
     */
    public function analisarTexto(string $texto): array
    {
        $systemInstruction = <<<'TEXT'
        És um analista de ouvidoria pública.
        Receberás o texto de um cidadão. Analisa e devolve em formato JSON:
        - sentiment: exatamente um de ["Excelente", "Satisfeito", "Neutro", "Preocupado", "Insatisfeito"]
        - category: exatamente um de ["Elogio", "Sugestão", "Dúvida", "Reclamação", "Denúncia"]
        - urgency: exatamente um de ["Baixa", "Média", "Alta", "Crítica"]
        - summary: resumo objetivo em português em até 2 frases
        - keywords: lista de 3 a 5 palavras-chave
        TEXT;

        $payload = [
            'contents' => [['parts' => [['text' => "Analise a manifestação:\n\"{$texto}\""]]]],
            'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                // ver comentário equivalente em analisarAudio().
                'thinkingConfig' => ['thinkingBudget' => 0],
                'responseSchema' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'sentiment' => ['type' => 'STRING', 'enum' => ['Excelente', 'Satisfeito', 'Neutro', 'Preocupado', 'Insatisfeito']],
                        'category' => ['type' => 'STRING', 'enum' => ['Elogio', 'Sugestão', 'Dúvida', 'Reclamação', 'Denúncia']],
                        'urgency' => ['type' => 'STRING', 'enum' => ['Baixa', 'Média', 'Alta', 'Crítica']],
                        'summary' => ['type' => 'STRING'],
                        'keywords' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    ],
                    'required' => ['sentiment', 'category', 'urgency', 'summary', 'keywords'],
                ],
            ],
        ];

        // gerarConteudoComRetry já devolve o objeto decodificado (extrai o
        // JSON internamente) - chamar extrairJson() de novo aqui em cima do
        // resultado (um array, não mais a string bruta) quebrava com
        // TypeError (achado real por teste com Http::fake).
        return $this->gerarConteudoComRetry(config('services.gemini.text_model'), $payload);
    }

    /**
     * Porta de `speakTextDirectly`/TTS: `{audioBase64, mimeType, sampleRate}`
     * a partir do PCM inline devolvido pela Gemini. `voz` default "Aoede",
     * mesmo default do protótipo.
     *
     * @return array{audioBase64: string, mimeType: string, sampleRate: int}
     */
    public function textoParaFala(string $texto, string $voz = 'Aoede'): array
    {
        $payload = [
            'contents' => [[
                'parts' => [['text' => "Say warmly and naturally in Portuguese: {$texto}"]],
            ]],
            'generationConfig' => [
                'responseModalities' => ['AUDIO'],
                'speechConfig' => ['voiceConfig' => ['prebuiltVoiceConfig' => ['voiceName' => $voz]]],
            ],
        ];

        $resultado = $this->chamarGeminiComRetry(config('services.gemini.tts_model'), $payload);
        $inlineAudio = data_get($resultado, 'candidates.0.content.parts.0.inlineData');

        if (! $inlineAudio || empty($inlineAudio['data'])) {
            throw new AiUnavailableException('Gemini TTS não devolveu áudio.');
        }

        $mimeType = $inlineAudio['mimeType'] ?? 'audio/pcm';

        return [
            'audioBase64' => $inlineAudio['data'],
            'mimeType' => $mimeType,
            'sampleRate' => $this->extrairSampleRate($mimeType),
        ];
    }

    /** Porta de `extractSampleRate`: lê `rate=` do mimeType, senão 24000. */
    private function extrairSampleRate(string $mimeType): int
    {
        return preg_match('/rate=(\d+)/', $mimeType, $m) ? (int) $m[1] : 24000;
    }

    /**
     * Chama `{model}:generateContent` e devolve `candidates.0.content.parts.0.text`
     * já decodificado de JSON - equivalente ao `JSON.parse(rawText)` do
     * protótipo, mas usando extração por profundidade de chaves (não
     * `json_decode` direto) porque a Gemini às vezes envolve o JSON em texto
     * extra mesmo com `responseMimeType: application/json` configurado.
     */
    private function gerarConteudoComRetry(string $model, array $payload): array
    {
        $resultado = $this->chamarGeminiComRetry($model, $payload);
        $rawText = data_get($resultado, 'candidates.0.content.parts.0.text');

        if (! $rawText) {
            throw new AiUnavailableException("Gemini ({$model}) não devolveu texto na resposta.");
        }

        return $this->extrairJson($rawText);
    }

    /**
     * Porta de `fetchWithRetry`: até 5 tentativas, atrasos 1s/2s/4s/8s/16s.
     * Diferente do protótipo (fetch no navegador), aqui é uma chamada
     * bloqueante de um worker PHP-FPM - pior caso ~31s de espera adicional
     * antes de desistir, aceitável porque é o mesmo comportamento (e mesmo
     * limite de tentativas) já validado no protótipo, só movido pro servidor.
     */
    private function chamarGeminiComRetry(string $model, array $payload): array
    {
        $apiKey = config('services.gemini.api_key');
        $url = rtrim(config('services.gemini.base_url'), '/')."/{$model}:generateContent?key={$apiKey}";

        for ($tentativa = 0; $tentativa < self::MAX_TENTATIVAS; $tentativa++) {
            try {
                $response = Http::timeout(60)->post($url, $payload);
                if ($response->successful()) {
                    return $response->json() ?? [];
                }
                Log::warning('GeminiAiService: resposta não-2xx', ['model' => $model, 'status' => $response->status(), 'tentativa' => $tentativa]);
            } catch (Throwable $e) {
                Log::warning('GeminiAiService: falha de conexão', ['model' => $model, 'erro' => $e->getMessage(), 'tentativa' => $tentativa]);
            }

            if ($tentativa < self::MAX_TENTATIVAS - 1) {
                usleep($this->delaysMs()[$tentativa] * 1000);
            }
        }

        throw new AiUnavailableException("Gemini ({$model}) indisponível após ".self::MAX_TENTATIVAS.' tentativas.');
    }

    /**
     * `services.gemini.retry_delays_ms` só existe pra testes zerarem o
     * backoff real (senão um teste do caminho de falha gastaria os ~31s de
     * espera de verdade) - em produção nunca é configurado, cai no mesmo
     * 1s/2s/4s/8s/16s do protótipo.
     */
    private function delaysMs(): array
    {
        return config('services.gemini.retry_delays_ms') ?? self::RETRY_DELAYS_MS;
    }

    /**
     * Extrai o primeiro objeto JSON válido da resposta, rastreando
     * profundidade de chaves (mesma técnica de
     * AiFailoverService::extrairJson do política-laravel) em vez de
     * `json_decode` direto ou regex guloso até o último "}" - ver CLAUDE.md
     * (política-laravel) pro bug histórico que essa técnica evita.
     */
    private function extrairJson(string $rawText): array
    {
        $rawText = trim($rawText);
        $inicio = strpos($rawText, '{');

        if ($inicio === false) {
            throw new AiUnavailableException('Nenhum objeto JSON encontrado na resposta da Gemini.');
        }

        $profundidade = 0;
        $dentroString = false;
        $escapando = false;
        $fim = null;
        $tamanho = strlen($rawText);

        for ($i = $inicio; $i < $tamanho; $i++) {
            $char = $rawText[$i];

            if ($escapando) {
                $escapando = false;

                continue;
            }

            if ($dentroString) {
                if ($char === '\\') {
                    $escapando = true;
                } elseif ($char === '"') {
                    $dentroString = false;
                }

                continue;
            }

            if ($char === '"') {
                $dentroString = true;
            } elseif ($char === '{') {
                $profundidade++;
            } elseif ($char === '}') {
                $profundidade--;
                if ($profundidade === 0) {
                    $fim = $i;
                    break;
                }
            }
        }

        if ($fim === null) {
            throw new AiUnavailableException('Objeto JSON da resposta da Gemini não fecha corretamente.');
        }

        $json = substr($rawText, $inicio, $fim - $inicio + 1);
        $decoded = json_decode($json, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new AiUnavailableException('JSON inválido na resposta da Gemini: '.json_last_error_msg());
        }

        return $decoded;
    }
}
