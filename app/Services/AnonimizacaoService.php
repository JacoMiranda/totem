<?php

namespace App\Services;

use App\Models\Manifestation;
use Illuminate\Support\Facades\Storage;

/**
 * LGPD (docs/PLANO-SISTEMA-PROFISSIONAL.md, Fase 8): remove o conteúdo
 * pessoal bruto de uma manifestação (áudio, transcrição, resumo,
 * keywords, vínculo com requerente) mantendo só o necessário pra
 * estatística agregada (protocolo, status, classificação, datas) -
 * minimização de dados, não apagamento total (isso quebraria relatórios
 * históricos). Usado tanto pelo job de retenção automática
 * (`ouvidoria:expurgar-lgpd`) quanto pelo pedido de eliminação do próprio
 * cidadão (PublicManifestationController::eliminar).
 */
class AnonimizacaoService
{
    public function anonimizar(Manifestation $manifestacao): void
    {
        if ($manifestacao->audio_object_key && Storage::disk('local')->exists($manifestacao->audio_object_key)) {
            Storage::disk('local')->delete($manifestacao->audio_object_key);
        }

        $manifestacao->update([
            'transcricao' => null,
            'resumo' => null,
            'keywords' => null,
            'requerente_type' => null,
            'requerente_id' => null,
            'audio_object_key' => null,
            'audio_mime' => null,
            'audio_duracao_seg' => null,
            'anonimizado_em' => now(),
        ]);
    }
}
