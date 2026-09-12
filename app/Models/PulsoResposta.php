<?php

namespace App\Models;

use App\Enums\PulsoValor;
use App\Models\Scopes\PorOrganizacao;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Um toque numa carinha - fato imutável, sem updated_at (ver ManifestationStatusHistory). */
#[Fillable(['pulso_ponto_id', 'organizacao_id', 'pergunta', 'valor', 'criado_em'])]
#[ScopedBy(PorOrganizacao::class)]
class PulsoResposta extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'valor' => PulsoValor::class,
            'criado_em' => 'datetime',
        ];
    }

    public function ponto(): BelongsTo
    {
        return $this->belongsTo(PulsoPonto::class, 'pulso_ponto_id');
    }
}
