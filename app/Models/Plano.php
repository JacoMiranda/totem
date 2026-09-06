<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'nome', 'descricao', 'limite_dispositivos', 'preco_centavos', 'recursos', 'trial_dias', 'ativo', 'ordem'])]
class Plano extends Model
{
    use HasUuids;

    protected $table = 'planos';

    protected function casts(): array
    {
        return [
            'recursos' => 'array',
            'ativo' => 'boolean',
        ];
    }

    public function organizacoes(): HasMany
    {
        return $this->hasMany(Organizacao::class);
    }

    /** Preço formatado pra home; nulo vira "sob consulta" (valores ainda não definidos). */
    public function precoFormatado(): ?string
    {
        return $this->preco_centavos === null
            ? null
            : 'R$ '.number_format($this->preco_centavos / 100, 2, ',', '.');
    }
}
