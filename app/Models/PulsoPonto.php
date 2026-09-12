<?php

namespace App\Models;

use App\Models\Scopes\PorOrganizacao;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Um QR físico impresso ("Pulso Rápido") - ver PulsoService. */
#[Fillable(['organizacao_id', 'nome', 'unidade', 'perguntas', 'token', 'ativo'])]
#[ScopedBy(PorOrganizacao::class)]
class PulsoPonto extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'perguntas' => 'array',
            'ativo' => 'boolean',
        ];
    }

    public function organizacao(): BelongsTo
    {
        return $this->belongsTo(Organizacao::class);
    }

    public function sessoes(): HasMany
    {
        return $this->hasMany(PulsoSessao::class);
    }

    public function respostas(): HasMany
    {
        return $this->hasMany(PulsoResposta::class);
    }
}
