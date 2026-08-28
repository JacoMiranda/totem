<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'unidade', 'ativo'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'ativo' => 'boolean',
            'ultimo_login_em' => 'datetime',
        ];
    }

    /** ver UserRole::atende() - hierarquia leitor < atendente < analista < admin. */
    public function temPapelMinimo(UserRole $minimo): bool
    {
        return $this->role->atende($minimo);
    }

    public function notificationPrefs(): HasMany
    {
        return $this->hasMany(NotificationPref::class);
    }
}
