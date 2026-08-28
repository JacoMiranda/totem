<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable(['nome', 'cpf', 'email', 'telefone'])]
class Person extends Model
{
    use HasUuids;

    public function manifestations(): MorphMany
    {
        return $this->morphMany(Manifestation::class, 'requerente');
    }
}
