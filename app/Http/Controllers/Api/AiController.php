<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\AiUnavailableException;
use App\Http\Controllers\Controller;
use App\Models\AiCache;
use App\Services\Ai\GeminiAiService;
use App\Services\Ai\LocalAnalysisFallback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Proxy de IA (docs/API.md, "IA (proxy) — device key") - só o totem chama
 * (device.key), nunca o painel admin. A chave Gemini nunca sai daqui (ver
 * App\Services\Ai\GeminiAiService).
 */
class AiController extends Controller
{
    public function __construct(
        private readonly GeminiAiService $gemini,
        private readonly LocalAnalysisFallback $fallback,
    ) {}

    /**
     * `multipart` (`file` = áudio) **ou** JSON `{ texto }` - equivale a
     * `processAudioRecording` do protótipo. Sem fallback local quando o
     * áudio não pôde ser transcrito (não há texto nenhum pra aplicar a
     * heurística) - mesmo comportamento do protótipo original (mostra aviso,
     * não inventa transcrição).
     */
    public function transcreverEAnalisar(Request $request): JsonResponse
    {
        if ($request->hasFile('file')) {
            $arquivo = $request->file('file');
            $base64Audio = base64_encode(file_get_contents($arquivo->getRealPath()));
            $mimeType = $arquivo->getMimeType() ?: 'audio/webm';

            try {
                $analise = $this->gemini->analisarAudio($base64Audio, $mimeType);

                return response()->json([...$analise, 'degraded' => false]);
            } catch (AiUnavailableException) {
                return response()->json(['error' => ['code' => 'AI_UNAVAILABLE', 'message' => 'Não foi possível transcrever o áudio no momento.']], 503);
            }
        }

        $validado = $request->validate(['texto' => ['required', 'string', 'min:5']]);

        try {
            $analise = $this->gemini->analisarTexto($validado['texto']);

            return response()->json([...$analise, 'transcription' => $validado['texto'], 'degraded' => false]);
        } catch (AiUnavailableException) {
            $degradado = $this->fallback->analisar($validado['texto']);

            return response()->json([...$degradado, 'transcription' => $validado['texto'], 'degraded' => true]);
        }
    }

    /** `{ texto }` → mesmo shape sem `transcription` - equivale a `triggerManualAnalysis`. */
    public function analisarTexto(Request $request): JsonResponse
    {
        $validado = $request->validate(['texto' => ['required', 'string', 'min:5']]);

        try {
            $analise = $this->gemini->analisarTexto($validado['texto']);

            return response()->json([...$analise, 'degraded' => false]);
        } catch (AiUnavailableException) {
            $degradado = $this->fallback->analisar($validado['texto']);

            return response()->json([...$degradado, 'degraded' => true]);
        }
    }

    /**
     * `{ texto, voz?: "Aoede" }` → `{ audioBase64, mimeType, sampleRate, cached }`
     * - equivale a `speakTextDirectly`. Cacheado em `ai_cache` por
     * sha256(texto+voz): o áudio (PCM bruto) vai pro disco local
     * (`storage/app/private`), metadados (mimeType/sampleRate) na própria
     * linha - evita reprocessar frases repetidas (ex.: os textos fixos de
     * instrução da cabine).
     */
    public function tts(Request $request): JsonResponse
    {
        $validado = $request->validate([
            'texto' => ['required', 'string'],
            'voz' => ['sometimes', 'string'],
        ]);
        $voz = $validado['voz'] ?? 'Aoede';
        $chave = hash('sha256', $validado['texto'].'|'.$voz);

        $cache = AiCache::where('chave', $chave)->where('tipo', 'tts')->first();
        if ($cache && $cache->object_key && Storage::disk('local')->exists($cache->object_key)) {
            $metadados = json_decode($cache->texto ?? '{}', true) ?: [];

            return response()->json([
                'audioBase64' => base64_encode(Storage::disk('local')->get($cache->object_key)),
                'mimeType' => $metadados['mimeType'] ?? 'audio/pcm',
                'sampleRate' => $metadados['sampleRate'] ?? 24000,
                'cached' => true,
            ]);
        }

        try {
            $resultado = $this->gemini->textoParaFala($validado['texto'], $voz);
        } catch (AiUnavailableException) {
            return response()->json(['error' => ['code' => 'AI_UNAVAILABLE', 'message' => 'Locução indisponível no momento.']], 503);
        }

        $objectKey = 'tts/'.$chave.'.pcm';
        Storage::disk('local')->put($objectKey, base64_decode($resultado['audioBase64']));

        AiCache::updateOrCreate(
            ['chave' => $chave, 'tipo' => 'tts'],
            [
                'object_key' => $objectKey,
                'texto' => json_encode(['mimeType' => $resultado['mimeType'], 'sampleRate' => $resultado['sampleRate']]),
                'criado_em' => now(),
            ],
        );

        return response()->json([...$resultado, 'cached' => false]);
    }
}
