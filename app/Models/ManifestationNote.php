<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['manifestation_id', 'autor_id', 'texto'])]
class ManifestationNote extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['criado_em' => 'datetime'];
    }

    public function manifestation(): BelongsTo
    {
        return $this->belongsTo(Manifestation::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }
}
