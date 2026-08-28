<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['codigo', 'nome', 'unidade', 'api_key_hash', 'ativo', 'ultima_sync_em', 'versao_app'])]
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

    public function manifestations(): HasMany
    {
        return $this->hasMany(Manifestation::class);
    }
}
