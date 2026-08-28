<?php

namespace App\Services;

use App\Models\ProtocolSequence;
use Illuminate\Support\Facades\DB;

/**
 * Gera o protocolo canônico OUV-AAAAMM-NNNNNN e o PIN de acompanhamento -
 * ver docs/ARQUITETURA.md (seção "PIN de acompanhamento") e MODELO-DADOS.md
 * (protocol_sequence). O incremento roda em transação com lockForUpdate
 * pra nunca duplicar o número sequencial mesmo com PHP-FPM concorrente
 * (vários workers do mesmo request de sync podendo colidir no mesmo mês).
 */
class ProtocoloService
{
    public function gerarProtocolo(?\DateTimeInterface $data = null): string
    {
        $data ??= now();
        $anoMes = $data->format('Ym');

        $numero = DB::transaction(function () use ($anoMes) {
            $sequencia = ProtocolSequence::where('ano_mes', $anoMes)->lockForUpdate()->first();

            if (! $sequencia) {
                $sequencia = ProtocolSequence::create(['ano_mes' => $anoMes, 'ultimo' => 0]);
            }

            $sequencia->increment('ultimo');

            return $sequencia->ultimo;
        });

        return sprintf('OUV-%s-%06d', $anoMes, $numero);
    }

    /** PIN de 4 dígitos - mostrado UMA ÚNICA VEZ na resposta de criação; só o hash é persistido (manifestation.pin_acompanhamento). */
    public function gerarPin(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    public function hashPin(string $pin): string
    {
        return hash('sha256', $pin);
    }
}
