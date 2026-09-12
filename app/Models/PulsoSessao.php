<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma abertura do QR (ver create_pulso_sessoes_table). */
#[Fillable(['pulso_ponto_id', 'hash', 'passo_atual', 'expira_em', 'concluida_em'])]
class PulsoSessao extends Model
{
    use HasUuids;

    // Eloquent pluraliza "Sessao" -> "Sessaos" (mesma classe de bug já
    // vista em ManifestationStatusHistory) - a migration usa o nome certo.
    protected $table = 'pulso_sessoes';

    protected function casts(): array
    {
        return [
            'expira_em' => 'datetime',
            'concluida_em' => 'datetime',
        ];
    }

    public function ponto(): BelongsTo
    {
        return $this->belongsTo(PulsoPonto::class, 'pulso_ponto_id');
    }

    public function expirada(): bool
    {
        return $this->expira_em->isPast();
    }

    public function concluida(): bool
    {
        return $this->concluida_em !== null;
    }
}
