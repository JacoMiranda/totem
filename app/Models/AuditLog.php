<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Auditoria imutável - registrar aqui: acesso a áudio, export, login, alteração de device, reclassificação. */
#[Fillable(['ator_id', 'device_id', 'acao', 'entidade', 'entidade_id', 'metadados', 'ip', 'criado_em'])]
class AuditLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'metadados' => 'array',
            'criado_em' => 'datetime',
        ];
    }

    public function ator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ator_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }
}
