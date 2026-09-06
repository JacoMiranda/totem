<?php

namespace App\Models;

use App\Models\Scopes\PorOrganizacao;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ScopedBy;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['organizacao_id', 'codigo', 'nome', 'unidade', 'api_key_hash', 'ativo', 'ultima_sync_em', 'versao_app'])]
#[ScopedBy(PorOrganizacao::class)]
#[Hidden(['api_key_hash'])]
class Device extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'ultima_sync_em' => 'datetime',
        ];
    }

    public function organizacao(): BelongsTo
    {
        return $this->belongsTo(Organizacao::class);
    }

    public function manifestations(): HasMany
    {
        return $this->hasMany(Manifestation::class);
    }
}
