<?php

namespace App\Models;

use App\Enums\NotifChannel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'tipo', 'canal', 'destino', 'ativo'])]
class NotificationPref extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'canal' => NotifChannel::class,
            'ativo' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
