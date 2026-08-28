<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['chave', 'tipo', 'object_key', 'texto', 'expira_em'])]
class AiCache extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'ai_cache';

    protected function casts(): array
    {
        return [
            'criado_em' => 'datetime',
            'expira_em' => 'datetime',
        ];
    }
}
