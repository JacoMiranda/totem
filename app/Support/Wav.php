<?php

namespace App\Support;

/**
 * A API Gemini TTS devolve PCM cru (16-bit little-endian, mono) - o
 * protótipo tocava isso direto via Web Audio API (`playPcmAudio`). Para
 * servir como arquivo estático (`<audio src>` / precache do Service
 * Worker), embrulhamos o PCM num container WAV mínimo: só o header
 * canônico de 44 bytes (RIFF/fmt /data), sem chunks extras.
 */
final class Wav
{
    /** PCM 16-bit mono => bytes de um arquivo .wav completo. */
    public static function fromPcm16Mono(string $pcm, int $sampleRate = 24000): string
    {
        $canais = 1;
        $bitsPorAmostra = 16;
        $blockAlign = $canais * ($bitsPorAmostra / 8);
        $byteRate = $sampleRate * $blockAlign;
        $tamanhoDados = strlen($pcm);

        $header = 'RIFF'
            .pack('V', 36 + $tamanhoDados)
            .'WAVE'
            .'fmt '
            .pack('V', 16)                 // tamanho do subchunk fmt
            .pack('v', 1)                  // PCM
            .pack('v', $canais)
            .pack('V', $sampleRate)
            .pack('V', $byteRate)
            .pack('v', $blockAlign)
            .pack('v', $bitsPorAmostra)
            .'data'
            .pack('V', $tamanhoDados);

        return $header.$pcm;
    }
}
