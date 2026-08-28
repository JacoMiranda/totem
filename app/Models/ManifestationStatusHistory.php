<?php

namespace App\Models;

use App\Enums\ManifestationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['manifestation_id', 'de_status', 'para_status', 'autor_id', 'motivo'])]
class ManifestationStatusHistory extends Model
{
    use HasUuids;

    // Eloquent pluraliza "History" -> "Histories" (regra irregular que ele
    // nao acerta contextualizado dentro de "ManifestationStatusHistory")
    // - mesma classe de bug ja vista no politica-laravel (PesquisaEleitoral,
    // BuscaAutomaticaPendente). Migration usa o nome singular de proposito.
    protected $table = 'manifestation_status_history';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'de_status' => ManifestationStatus::class,
            'para_status' => ManifestationStatus::class,
            'criado_em' => 'datetime',
        ];
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
