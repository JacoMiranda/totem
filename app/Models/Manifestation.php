<?php

namespace App\Models;

use App\Enums\Category;
use App\Enums\Channel;
use App\Enums\ManifestationStatus;
use App\Enums\Sentiment;
use App\Enums\Urgency;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'protocolo', 'client_id', 'pin_acompanhamento', 'canal', 'device_id',
    'requerente_type', 'requerente_id', 'transcricao', 'resumo', 'keywords',
    'sentimento', 'categoria', 'urgencia', 'status', 'responsavel_id',
    'resposta_oficial', 'resposta_publicada_em', 'audio_object_key', 'audio_mime',
    'audio_duracao_seg', 'consentimento_lgpd', 'origem_ip', 'criado_em', 'anonimizado_em',
])]
#[Hidden(['pin_acompanhamento'])]
class Manifestation extends Model
{
    use HasUuids;

    /**
     * `criado_em` (data do atendimento, vem do device) é DIFERENTE de
     * recebido_em/atualizado_em (quando a API de fato gravou/alterou) -
     * ver comentário na migration. Eloquent trata recebido_em/
     * atualizado_em como os timestamps automáticos de sempre.
     */
    const CREATED_AT = 'recebido_em';

    const UPDATED_AT = 'atualizado_em';

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'sentimento' => Sentiment::class,
            'categoria' => Category::class,
            'urgencia' => Urgency::class,
            'status' => ManifestationStatus::class,
            'canal' => Channel::class,
            'consentimento_lgpd' => 'boolean',
            'transcricao' => 'encrypted',
            'resposta_publicada_em' => 'datetime',
            'criado_em' => 'datetime',
            'anonimizado_em' => 'datetime',
        ];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function responsavel(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsavel_id');
    }

    /** Person ou Company - nulo quando a manifestação é anônima (modo padrão do totem). */
    public function requerente(): MorphTo
    {
        return $this->morphTo();
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ManifestationStatusHistory::class)->latest('criado_em');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(ManifestationNote::class)->latest('criado_em');
    }
}
