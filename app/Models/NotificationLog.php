<?php

namespace App\Models;

use App\Enums\NotifChannel;
use App\Enums\NotifStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['manifestation_id', 'tipo', 'canal', 'destino', 'payload', 'status', 'tentativas', 'enviada_em'])]
class NotificationLog extends Model
{
    use HasUuids;

    protected $table = 'notification_logs';

    protected function casts(): array
    {
        return [
            'canal' => NotifChannel::class,
            'status' => NotifStatus::class,
            'payload' => 'array',
            'enviada_em' => 'datetime',
        ];
    }

    public function manifestation(): BelongsTo
    {
        return $this->belongsTo(Manifestation::class);
    }
}
