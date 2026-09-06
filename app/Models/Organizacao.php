<?php

namespace App\Models;

use App\Enums\OrganizacaoStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Conta do cliente (tenant). O `slug` é a base do código dos totens -
 * "Luiza Brok" vira "LuizaBrok", que gera LuizaBrok-01, LuizaBrok-02...
 * (ver App\Services\NomeadorDeTotens).
 */
#[Fillable([
    'nome', 'slug', 'documento', 'plano_id', 'status', 'trial_expira_em',
    'mural_ativo', 'mural_token', 'mural_titulo', 'mural_tema',
])]
class Organizacao extends Model
{
    use HasUuids;

    protected $table = 'organizacoes';

    protected function casts(): array
    {
        return [
            'status' => OrganizacaoStatus::class,
            'trial_expira_em' => 'datetime',
            'mural_ativo' => 'boolean',
        ];
    }

    /** Título do mural público, com fallback pro nome da conta. */
    public function muralTitulo(): string
    {
        return $this->mural_titulo ?: 'Ouvidoria · '.$this->nome;
    }

    public function plano(): BelongsTo
    {
        return $this->belongsTo(Plano::class);
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    /** Conta operante = trial válido ou ativa. Trial vencido não opera. */
    public function operante(): bool
    {
        if (! $this->status->operante()) {
            return false;
        }

        if ($this->status === OrganizacaoStatus::Trial && $this->trial_expira_em?->isPast()) {
            return false;
        }

        return true;
    }

    /** Quantos totens ainda cabem no pacote contratado. */
    public function vagasDeTotem(): int
    {
        $limite = $this->plano?->limite_dispositivos ?? 0;

        return max(0, $limite - $this->devices()->count());
    }
}
